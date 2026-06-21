import math
from datetime import UTC, datetime, timedelta

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models import Badge, BadgeRuleType, Challenge, CheckIn, User, UserBadge


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Entfernung in Metern zwischen zwei GPS-Koordinaten (Haversine-Formel)."""
    R = 6_371_000  # Erdradius in Metern
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


async def already_checked_in_today(db: AsyncSession, user_id: int, challenge_id: int) -> bool:
    """Challenges können nur einmal abgeschlossen werden – unabhängig vom Tag."""
    result = await db.execute(
        select(CheckIn).where(
            and_(
                CheckIn.user_id == user_id,
                CheckIn.challenge_id == challenge_id,
                CheckIn.success == True,  # noqa: E712
            )
        )
    )
    return result.scalar_one_or_none() is not None


async def award_badges(db: AsyncSession, user: User) -> list[Badge]:
    """Prüft und vergibt neue Badges nach einem erfolgreichen Check-in."""
    result = await db.execute(select(Badge))
    all_badges = result.scalars().all()

    already_result = await db.execute(
        select(UserBadge.badge_id).where(UserBadge.user_id == user.id)
    )
    already_awarded = set(already_result.scalars().all())

    checkin_count_result = await db.execute(
        select(func.count()).where(
            and_(CheckIn.user_id == user.id, CheckIn.success == True)  # noqa: E712
        )
    )
    checkin_count = checkin_count_result.scalar_one()

    newly_awarded: list[Badge] = []
    for badge in all_badges:
        if badge.id in already_awarded:
            continue

        earned = False
        if badge.rule_type == BadgeRuleType.CHECKIN_COUNT:
            earned = checkin_count >= int(badge.rule_value)
        elif badge.rule_type == BadgeRuleType.ALL_CHALLENGES:
            total_result = await db.execute(
                select(func.count()).select_from(
                    select(CheckIn.challenge_id)
                    .where(and_(CheckIn.user_id == user.id, CheckIn.success == True))  # noqa: E712
                    .distinct()
                    .subquery()
                )
            )
            unique_count = total_result.scalar_one()
            earned = unique_count >= int(badge.rule_value)
        elif badge.rule_type == BadgeRuleType.STREAK_DAYS:
            earned = await _check_streak(db, user.id, int(badge.rule_value))

        if earned:
            db.add(UserBadge(user_id=user.id, badge_id=badge.id))
            newly_awarded.append(badge)

    return newly_awarded


async def _check_streak(db: AsyncSession, user_id: int, required_days: int) -> bool:
    today = datetime.now(UTC).date()
    streak = 0
    for delta in range(required_days):
        day = today - timedelta(days=delta)
        day_start = datetime(day.year, day.month, day.day, tzinfo=UTC)
        day_end = day_start + timedelta(days=1)
        result = await db.execute(
            select(func.count()).where(
                and_(
                    CheckIn.user_id == user_id,
                    CheckIn.success == True,  # noqa: E712
                    CheckIn.checked_in_at >= day_start,
                    CheckIn.checked_in_at < day_end,
                )
            )
        )
        count = result.scalar_one()
        if count > 0:
            streak += 1
        else:
            break
    return streak >= required_days
