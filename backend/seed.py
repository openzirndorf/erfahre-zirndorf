"""
Seed-Script für "Erfahre Zirndorf"

Checkpoints werden aus challenges.json geladen (kommt via CI aus erfahre-assets).

Aufruf:
    python seed.py                    # mit Test-Accounts
    python seed.py --no-testusers     # ohne Test-Accounts (Produktion)
"""
import asyncio
import json
import os
import sys
from datetime import UTC, datetime, timedelta, date
from zoneinfo import ZoneInfo

BERLIN = ZoneInfo("Europe/Berlin")
from pathlib import Path

os.environ.setdefault("SECRET_KEY", "dev-secret-change-me")
os.environ.setdefault("ADMIN_TOKEN", "dev-admin-token")

from database import init_db, AsyncSessionLocal
from models import Badge, BadgeRuleType, Challenge, CheckIn, Place, User, UserBadge, UserRole

EVENT_START  = date(2026, 6, 6)
EVENT_END    = date(2026, 7, 12)
SOFORT_START = date(2026, 5, 31)
TODAY        = date.today()
DATA_FILE    = Path(__file__).parent / "challenges.json"

BADGES = [
    {"title": "Erster Tritt",    "description": "Erster erfolgreicher Check-in",  "icon": "🚴", "rule_type": BadgeRuleType.CHECKIN_COUNT,  "rule_value": "1"},
    {"title": "Fünf Orte",       "description": "5 Check-ins abgeschlossen",       "icon": "⭐", "rule_type": BadgeRuleType.CHECKIN_COUNT,  "rule_value": "5"},
    {"title": "Halbzeit!",       "description": "10 Check-ins abgeschlossen",      "icon": "🏁", "rule_type": BadgeRuleType.CHECKIN_COUNT,  "rule_value": "10"},
    {"title": "Fast da!",        "description": "15 Check-ins abgeschlossen",      "icon": "🔥", "rule_type": BadgeRuleType.CHECKIN_COUNT,  "rule_value": "15"},
    {"title": "Zirndorf-Kenner", "description": "Alle Orte besucht",              "icon": "🏆", "rule_type": BadgeRuleType.ALL_CHALLENGES, "rule_value": "25"},
    {"title": "3 Tage am Stück", "description": "3 Tage in Folge eingecheckt",    "icon": "📅", "rule_type": BadgeRuleType.STREAK_DAYS,    "rule_value": "3"},
    {"title": "Woche durch!",    "description": "7 Tage in Folge eingecheckt",    "icon": "🗓️","rule_type": BadgeRuleType.STREAK_DAYS,    "rule_value": "7"},
]

TEST_USERS = [
    {"email": "anna@example.com",  "display_name": "Anna"},
    {"email": "bert@example.com",  "display_name": "Bert"},
    {"email": "clara@example.com", "display_name": "Clara"},
    {"email": "david@example.com", "display_name": "David"},
    {"email": "eva@example.com",   "display_name": "Eva"},
]


def load_data() -> list[dict]:
    if not DATA_FILE.exists():
        print(f"FEHLER: {DATA_FILE} nicht gefunden.")
        sys.exit(1)
    with DATA_FILE.open(encoding="utf-8") as f:
        return json.load(f)["checkpoints"]


async def sync_places(checkpoints: list[dict]) -> None:
    """Synchronisiert Orte/Challenges exakt mit challenges.json.

    - Neue Einträge werden angelegt.
    - Bestehende werden aktualisiert.
    - Einträge die NICHT mehr in der JSON sind:
        → werden gelöscht wenn keine Check-ins existieren
        → werden deaktiviert (is_active=False) wenn Check-ins vorhanden sind
    Nutzer, Check-ins und Badges werden NICHT angefasst.
    """
    from sqlalchemy import select as sa_select, func as sa_func

    end_dt    = datetime(EVENT_END.year,    EVENT_END.month,    EVENT_END.day,    23, 59, 59, tzinfo=UTC)
    sofort_dt = datetime(SOFORT_START.year, SOFORT_START.month, SOFORT_START.day,  0,  0,  0, tzinfo=UTC)

    await init_db()

    json_titles = {cp["title"] for cp in checkpoints}

    async with AsyncSessionLocal() as db:
        updated = created = deleted = deactivated = 0

        # ── Leichen entfernen ────────────────────────────────────────────────
        all_places = (await db.execute(sa_select(Place))).scalars().all()
        for place in all_places:
            if place.title not in json_titles:
                ch = (await db.execute(
                    sa_select(Challenge).where(Challenge.place_id == place.id)
                )).scalar_one_or_none()
                if ch:
                    has_checkins = (await db.execute(
                        sa_select(sa_func.count()).where(CheckIn.challenge_id == ch.id)
                    )).scalar_one()
                    if has_checkins:
                        ch.is_active = False
                        deactivated += 1
                        print(f"  ⚠ Deaktiviert (hat Check-ins): {place.title}")
                    else:
                        await db.delete(ch)
                        await db.delete(place)
                        deleted += 1
                        print(f"  🗑 Gelöscht: {place.title}")
                else:
                    await db.delete(place)
                    deleted += 1
        await db.flush()

        # ── Aktualisieren / Anlegen ──────────────────────────────────────────
        for cp in checkpoints:
            cp_date = cp.get("date")
            if cp_date is None:
                start = sofort_dt
                day_num = None
            else:
                if len(str(cp_date)) != 10:
                    raise ValueError(f"Ungültiges Datum {cp_date!r} bei '{cp['title']}' – erwartet YYYY-MM-DD")
                d = date.fromisoformat(cp_date)
                # Uhrzeit: Optional aus "time" Feld (HH:MM Berliner Zeit), sonst 07:00
                time_str = cp.get("time", "07:00")
                try:
                    hour, minute = map(int, time_str.split(":"))
                    start = datetime(d.year, d.month, d.day, hour, minute, 0, tzinfo=BERLIN).astimezone(UTC)
                except (ValueError, AttributeError):
                    raise ValueError(f"Ungültiges Zeitformat '{time_str}' bei '{cp['title']}' – erwartet HH:MM")
                day_num = (d - EVENT_START).days + 1

            place = (await db.execute(
                sa_select(Place).where(Place.title == cp["title"])
            )).scalar_one_or_none()

            if place:
                place.lat = cp["lat"]; place.lon = cp["lon"]
                place.radius_m = cp.get("radius_m", 75.0)
                place.image_url = cp.get("image_url")
                place.category = cp.get("category")
                place.description = cp.get("description")
            else:
                place = Place(
                    title=cp["title"], description=cp.get("description"),
                    lat=cp["lat"], lon=cp["lon"], radius_m=cp.get("radius_m", 75.0),
                    category=cp.get("category"), image_url=cp.get("image_url"),
                )
                db.add(place)
            await db.flush()

            ch = (await db.execute(
                sa_select(Challenge).where(Challenge.place_id == place.id)
            )).scalar_one_or_none()

            if ch:
                ch.title = cp["title"]; ch.description = cp.get("description", "")
                ch.story = cp.get("story"); ch.points = cp.get("points", 20)
                ch.category = cp.get("category"); ch.start_at = start
                ch.end_at = end_dt; ch.day_number = day_num
                ch.is_active = bool(cp.get("is_active", True))
                ch.is_mystery = bool(cp.get("mystery", False))
                ch.is_task = bool(cp.get("task", False))
                ch.is_photo = bool(cp.get("is_photo", False))
                ch.quiz_question = cp.get("quiz_question")
                ch.quiz_options = cp.get("quiz_options")
                ch.quiz_correct_index = cp.get("quiz_correct_index")
                updated += 1
            else:
                db.add(Challenge(
                    place_id=place.id, title=cp["title"],
                    description=cp.get("description", ""), story=cp.get("story"),
                    day_number=day_num, start_at=start, end_at=end_dt,
                    points=cp.get("points", 20), category=cp.get("category"),
                    is_active=bool(cp.get("is_active", True)),
                    is_mystery=bool(cp.get("mystery", False)),
                    is_task=bool(cp.get("task", False)),
                    is_photo=bool(cp.get("is_photo", False)),
                    quiz_question=cp.get("quiz_question"),
                    quiz_options=cp.get("quiz_options"),
                    quiz_correct_index=cp.get("quiz_correct_index"),
                ))
                created += 1

        await db.commit()
        print(f"✓ Sync abgeschlossen: {updated} aktualisiert, {created} neu, {deleted} gelöscht, {deactivated} deaktiviert.")


async def seed(with_testusers: bool = True, skip_if_users: bool = False) -> None:
    checkpoints = load_data()

    end_dt    = datetime(EVENT_END.year,    EVENT_END.month,    EVENT_END.day,    23, 59, 59, tzinfo=UTC)
    sofort_dt = datetime(SOFORT_START.year, SOFORT_START.month, SOFORT_START.day,  0,  0,  0, tzinfo=UTC)

    await init_db()

    async with AsyncSessionLocal() as db:
        from sqlalchemy import select as sa_select, text, func

        if skip_if_users:
            user_count = (await db.execute(
                sa_select(func.count()).select_from(User)
            )).scalar_one()
            if user_count > 0:
                print(f"⏭  {user_count} Nutzer gefunden – Seed übersprungen (Produktionsdaten bleiben erhalten).")
                return

        for table in ["user_badges", "checkins", "challenges", "badges", "places", "users"]:
            await db.execute(text(f"DELETE FROM {table}"))
        await db.commit()
        print("Tabellen geleert.")

        sofort_count = 0
        daily_count  = 0

        for cp in checkpoints:
            place = Place(
                title=cp["title"],
                description=cp.get("description"),
                lat=cp["lat"],
                lon=cp["lon"],
                radius_m=cp.get("radius_m", 75.0),
                category=cp.get("category"),
                image_url=cp.get("image_url"),
            )
            db.add(place)
            await db.flush()

            cp_date = cp.get("date")
            if cp_date is None:
                start = sofort_dt
                day_number = None
                sofort_count += 1
            else:
                if len(str(cp_date)) != 10:
                    raise ValueError(f"Ungültiges Datum {cp_date!r} bei '{cp['title']}' – erwartet YYYY-MM-DD")
                d = date.fromisoformat(cp_date)
                start = datetime(d.year, d.month, d.day, 7, 0, 0, tzinfo=BERLIN).astimezone(UTC)
                day_number = (d - EVENT_START).days + 1
                daily_count += 1

            db.add(Challenge(
                place_id=place.id,
                title=cp["title"],
                description=cp.get("description", ""),
                story=cp.get("story"),
                day_number=day_number,
                start_at=start,
                end_at=end_dt,
                points=cp.get("points", 20),
                category=cp.get("category"),
                is_active=bool(cp.get("is_active", True)),
                is_mystery=bool(cp.get("mystery", False)),
                is_task=bool(cp.get("task", False)),
                is_photo=bool(cp.get("is_photo", False)),
            ))

        await db.flush()
        print(f"{sofort_count} Sofort-Checkpoints (ab {SOFORT_START.strftime('%d.%m.%Y')}).")
        last_day_date = EVENT_START + timedelta(days=daily_count - 1)
        print(f"{daily_count} Tages-Checkpoints ({EVENT_START.strftime('%d.%m.')}–{last_day_date.strftime('%d.%m.%Y')}).")

        # Test-Checkpoints für lokale Entwicklung (vergangene Tage)
        if with_testusers:
            from sqlalchemy import select as sa_select
            test_places = (await db.execute(sa_select(Place).limit(3))).scalars().all()
            for i, tp in enumerate(test_places):
                past_day = TODAY - timedelta(days=len(test_places) - i)
                start = datetime(past_day.year, past_day.month, past_day.day, 0, 0, 0, tzinfo=UTC)
                db.add(Challenge(
                    place_id=tp.id,
                    title=f"Testlauf: {tp.title}",
                    description="Vergangene Challenge für lokale Entwicklung.",
                    start_at=start,
                    end_at=end_dt,
                    points=15,
                    is_active=True,
                ))
            await db.flush()
            print(f"{len(test_places)} Test-Challenges angelegt.")

        # Badges
        for b in BADGES:
            db.add(Badge(**b))
        await db.flush()
        print(f"{len(BADGES)} Badges angelegt.")

        # Admin
        db.add(User(email="admin@example.com", display_name="Admin",
                    consent_given=True, role=UserRole.ADMIN))
        await db.flush()

        if with_testusers:
            from sqlalchemy import select as sa_select
            users: list[User] = []
            for u in TEST_USERS:
                user = User(email=u["email"], display_name=u["display_name"], consent_given=True)
                db.add(user)
                users.append(user)
            await db.flush()

            all_ch = (await db.execute(
                sa_select(Challenge).order_by(Challenge.day_number.nulls_last(), Challenge.start_at)
            )).scalars().all()

            for user, count in zip(users, [8, 5, 12, 3, 1]):
                for challenge in all_ch[:count]:
                    t = challenge.start_at.replace(tzinfo=UTC)
                    db.add(CheckIn(
                        user_id=user.id, challenge_id=challenge.id, success=True,
                        distance_m=round(20 + (user.id * 7) % 40),
                        accuracy_m=round(8 + (user.id * 3) % 12),
                        checked_in_at=t.replace(hour=10, minute=30),
                    ))
                    user.points += challenge.points
            await db.flush()

            all_badges = (await db.execute(sa_select(Badge))).scalars().all()
            clara = users[2]
            for badge in all_badges:
                if badge.rule_type == BadgeRuleType.CHECKIN_COUNT and int(badge.rule_value) <= 12:
                    db.add(UserBadge(user_id=clara.id, badge_id=badge.id))
                if badge.rule_type == BadgeRuleType.STREAK_DAYS and int(badge.rule_value) <= 7:
                    db.add(UserBadge(user_id=clara.id, badge_id=badge.id))

            print(f"{len(TEST_USERS)} Test-User angelegt.")

        await db.commit()
        print(f"\n✓ Seed abgeschlossen! Event: {EVENT_START.strftime('%d.%m.')}–{EVENT_END.strftime('%d.%m.%Y')}")


if __name__ == "__main__":
    if "--sync" in sys.argv or "--update-places" in sys.argv:
        asyncio.run(sync_places(load_data()))
    else:
        asyncio.run(seed(
            with_testusers="--no-testusers" not in sys.argv,
            skip_if_users="--skip-if-users" in sys.argv,
        ))
