from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from auth import get_optional_user
from config import settings
from database import get_db
from models import Challenge, CheckIn, PhotoSubmission, User, UserRole

router = APIRouter(prefix="/api/challenges", tags=["challenges"])

# Dummy-Koordinaten für Mystery-Challenges – über Zirndorf verteilt, rotieren per Challenge-ID
_MYSTERY_PINS = [
    (49.4489, 10.9423),  # Norden / Nähe Gebersdorf
    (49.4513, 10.9601),  # Nordost
    (49.4468, 10.9672),  # Ost / Leichendorf
    (49.4398, 10.9634),  # Südost
    (49.4361, 10.9501),  # Süd / Weiherhof
    (49.4382, 10.9378),  # Südwest
    (49.4441, 10.9312),  # West
    (49.4502, 10.9389),  # Nordwest
]
MYSTERY_DAILY_LIMIT = 5


class PlaceOut(BaseModel):
    id: int
    title: str
    description: str | None
    lat: float
    lon: float
    radius_m: float
    category: str | None
    image_url: str | None
    model_config = {"from_attributes": True}


class ChallengeOut(BaseModel):
    id: int
    title: str
    description: str
    story: str | None
    day_number: int | None
    start_at: datetime
    end_at: datetime
    points: int
    category: str | None
    is_active: bool
    is_mystery: bool = False
    is_task: bool = False
    is_photo: bool = False
    quiz_question: str | None = None
    quiz_options: list[str] | None = None
    place: PlaceOut
    # Bonus-Transparenz
    checkin_count: int = 0       # globale Anzahl erfolgreicher Check-ins
    first_day_active: bool = False  # heute ist der erste Tag dieser Challenge
    model_config = {"from_attributes": True}


class ChallengeWithStatus(ChallengeOut):
    user_checked_in: bool = False
    mystery_attempts_left: int | None = None
    photo_submission_status: str | None = None
    photo_admin_message: str | None = None


def _is_active_now(challenge: Challenge) -> bool:
    """Aktiv = freigeschaltet (start_at erreicht). Kein Ablaufdatum mehr."""
    now = datetime.now(UTC)
    start = challenge.start_at.replace(tzinfo=UTC) if challenge.start_at.tzinfo is None else challenge.start_at
    return challenge.is_active and start <= now


def _first_day(challenge: Challenge) -> bool:
    start = challenge.start_at.replace(tzinfo=UTC) if challenge.start_at.tzinfo is None else challenge.start_at
    return (datetime.now(UTC).date() - start.date()).days <= 1


_counts_cache: dict[int, int] = {}
_counts_cache_ts: float = 0.0
_COUNTS_TTL = 30.0  # Sekunden


async def _checkin_counts(db: AsyncSession, challenge_ids: list[int]) -> dict[int, int]:
    global _counts_cache, _counts_cache_ts
    import time
    if challenge_ids and time.monotonic() - _counts_cache_ts < _COUNTS_TTL:
        return {cid: _counts_cache.get(cid, 0) for cid in challenge_ids}
    result = await db.execute(
        select(CheckIn.challenge_id, func.count().label("n"))
        .where(CheckIn.success == True)  # noqa: E712
        .group_by(CheckIn.challenge_id)
    )
    _counts_cache = {row.challenge_id: row.n for row in result.all()}
    _counts_cache_ts = time.monotonic()
    return {cid: _counts_cache.get(cid, 0) for cid in challenge_ids}


def _as_utc(dt: datetime) -> datetime:
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=UTC)


def _to_out(c: Challenge, count: int = 0, mystery_index: int | None = None) -> ChallengeOut:
    if c.is_mystery:
        pin_index = mystery_index if mystery_index is not None else c.id % len(_MYSTERY_PINS)
        dummy_lat, dummy_lon = _MYSTERY_PINS[pin_index % len(_MYSTERY_PINS)]
        place_out = PlaceOut(
            id=c.place.id, title="Mystery Ort", description=None,
            lat=dummy_lat, lon=dummy_lon,
            radius_m=c.place.radius_m, category=c.place.category,
            image_url=c.place.image_url,
        )
    else:
        place_out = PlaceOut.model_validate(c.place)
    return ChallengeOut(
        id=c.id,
        title=c.title,
        description=c.description,
        story=c.story,
        day_number=c.day_number,
        start_at=_as_utc(c.start_at),
        end_at=_as_utc(c.end_at),
        points=c.points,
        category=c.category,
        is_active=_is_active_now(c),
        is_mystery=c.is_mystery,
        is_task=c.is_task,
        is_photo=c.is_photo,
        quiz_question=c.quiz_question,
        quiz_options=c.quiz_options,
        place=place_out,
        checkin_count=count,
        first_day_active=_first_day(c),
    )


@router.get("", response_model=list[ChallengeWithStatus])
async def list_challenges(
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    """Gibt nur bereits gestartete Challenges zurück. Zukünftige Orte werden nicht exponiert."""
    now = datetime.now(UTC)
    result = await db.execute(
        select(Challenge)
        .options(selectinload(Challenge.place))
        .where(
            Challenge.is_active == True,  # noqa: E712
            Challenge.start_at <= now,
        )
        .order_by(Challenge.day_number, Challenge.start_at)
    )
    challenges = result.scalars().all()
    counts = await _checkin_counts(db, [c.id for c in challenges])

    checked_ids: set[int] = set()
    photo_status_map: dict[int, str] = {}
    if current_user:
        ci_result = await db.execute(
            select(CheckIn.challenge_id).where(
                CheckIn.user_id == current_user.id,
                CheckIn.success == True,  # noqa: E712
            )
        )
        checked_ids = set(ci_result.scalars().all())
        photo_ids = [c.id for c in challenges if c.is_photo and c.id in checked_ids]
        if photo_ids:
            ps_result = await db.execute(
                select(PhotoSubmission.challenge_id, PhotoSubmission.status).where(
                    PhotoSubmission.user_id == current_user.id,
                    PhotoSubmission.challenge_id.in_(photo_ids),
                )
            )
            photo_status_map = {row.challenge_id: row.status for row in ps_result.all()}

    mystery_counter = 0
    result_list = []
    for c in challenges:
        mi = mystery_counter if c.is_mystery else None
        if c.is_mystery:
            mystery_counter += 1
        result_list.append(ChallengeWithStatus(
            **_to_out(c, counts.get(c.id, 0), mystery_index=mi).model_dump(),
            user_checked_in=c.id in checked_ids,
            photo_submission_status=photo_status_map.get(c.id),
        ))
    return result_list


@router.get("/stats", response_model=dict)
async def challenge_stats(db: AsyncSession = Depends(get_db)):
    """Gesamtzahl aller Challenges – damit das Frontend weiß wie viele noch kommen."""
    total = (await db.execute(
        select(func.count()).where(Challenge.is_active == True)  # noqa: E712
    )).scalar_one()
    started = (await db.execute(
        select(func.count()).where(
            Challenge.is_active == True,  # noqa: E712
            Challenge.start_at <= datetime.now(UTC),
        )
    )).scalar_one()
    return {"total": total, "started": started, "upcoming": total - started}


@router.get("/today", response_model=list[ChallengeWithStatus])
async def today_challenges(
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    """Challenges die heute freigeschaltet wurden (start_at = heute in UTC)."""
    now = datetime.now(UTC)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    result = await db.execute(
        select(Challenge)
        .options(selectinload(Challenge.place))
        .where(
            Challenge.is_active == True,  # noqa: E712
            Challenge.start_at >= today_start,
            Challenge.start_at <= now,
        )
        .order_by(Challenge.day_number)
    )
    challenges = result.scalars().all()
    counts = await _checkin_counts(db, [c.id for c in challenges])

    checked_ids: set[int] = set()
    photo_status_map2: dict[int, str] = {}
    if current_user:
        ci_result = await db.execute(
            select(CheckIn.challenge_id).where(
                CheckIn.user_id == current_user.id,
                CheckIn.success == True,  # noqa: E712
            )
        )
        checked_ids = set(ci_result.scalars().all())
        photo_ids = [c.id for c in challenges if c.is_photo and c.id in checked_ids]
        if photo_ids:
            ps_result = await db.execute(
                select(PhotoSubmission.challenge_id, PhotoSubmission.status).where(
                    PhotoSubmission.user_id == current_user.id,
                    PhotoSubmission.challenge_id.in_(photo_ids),
                )
            )
            photo_status_map2 = {row.challenge_id: row.status for row in ps_result.all()}

    mystery_counter = 0
    result_list = []
    for c in challenges:
        mi = mystery_counter if c.is_mystery else None
        if c.is_mystery:
            mystery_counter += 1
        result_list.append(ChallengeWithStatus(
            **_to_out(c, counts.get(c.id, 0), mystery_index=mi).model_dump(),
            user_checked_in=c.id in checked_ids,
            photo_submission_status=photo_status_map2.get(c.id),
        ))
    return result_list


@router.get("/{challenge_id}", response_model=ChallengeWithStatus)
async def get_challenge(
    challenge_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
    preview: bool = Query(False),
):
    result = await db.execute(
        select(Challenge)
        .options(selectinload(Challenge.place))
        .where(Challenge.id == challenge_id)
    )
    challenge = result.scalar_one_or_none()
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge nicht gefunden")

    is_admin = current_user is not None and current_user.role == UserRole.ADMIN
    start = challenge.start_at.replace(tzinfo=UTC) if challenge.start_at.tzinfo is None else challenge.start_at
    if datetime.now(UTC) < start and not (preview and is_admin):
        raise HTTPException(status_code=404, detail="Challenge nicht gefunden")

    counts = await _checkin_counts(db, [challenge_id])

    checked = False
    mystery_attempts_left: int | None = None
    photo_submission_status: str | None = None
    photo_admin_message: str | None = None
    if current_user:
        ci_result = await db.execute(
            select(CheckIn).where(
                CheckIn.user_id == current_user.id,
                CheckIn.challenge_id == challenge_id,
                CheckIn.success == True,  # noqa: E712
            )
        )
        checked = ci_result.scalar_one_or_none() is not None

        if challenge.is_mystery and not checked:
            today_start = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
            attempts_today = (await db.execute(
                select(func.count()).where(
                    CheckIn.user_id == current_user.id,
                    CheckIn.challenge_id == challenge_id,
                    CheckIn.success == False,  # noqa: E712
                    CheckIn.checked_in_at >= today_start,
                )
            )).scalar_one()
            mystery_attempts_left = max(0, MYSTERY_DAILY_LIMIT - attempts_today)

        if challenge.is_photo and checked:
            ps_result = await db.execute(
                select(PhotoSubmission.status, PhotoSubmission.admin_message).where(
                    PhotoSubmission.user_id == current_user.id,
                    PhotoSubmission.challenge_id == challenge_id,
                )
            )
            row = ps_result.one_or_none()
            if row:
                photo_submission_status = row.status
                photo_admin_message = row.admin_message if row.status == "rejected" else None

    return ChallengeWithStatus(
        **_to_out(challenge, counts.get(challenge_id, 0)).model_dump(),
        user_checked_in=checked,
        mystery_attempts_left=mystery_attempts_left,
        photo_submission_status=photo_submission_status,
        photo_admin_message=photo_admin_message,
    )
