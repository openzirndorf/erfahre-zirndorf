from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from auth import get_current_user
from checkin_logic import already_checked_in_today, award_badges, haversine
from config import settings
from database import get_db
from models import Challenge, CheckIn, QuizAttempt, User
from routers import challenges as challenges_router

limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/api/checkins", tags=["checkins"])


class Position(BaseModel):
    lat: float
    lon: float
    accuracy_m: float


class CheckInRequest(BaseModel):
    challenge_id: int
    position: Position
    client_ts: datetime | None = None
    quiz_answer_index: int | None = None


class BadgeOut(BaseModel):
    id: int
    title: str
    icon: str
    description: str

    model_config = {"from_attributes": True}


class BonusInfo(BaseModel):
    points: int
    reason: str


MYSTERY_DAILY_LIMIT = 5

class CheckInResponse(BaseModel):
    success: bool
    message: str
    points_awarded: int = 0
    bonuses: list[BonusInfo] = []
    badges_unlocked: list[BadgeOut] = []
    distance_m: float | None = None
    is_flagged: bool = False
    attempts_left: int | None = None


async def _count_successful_checkins(db: AsyncSession, challenge_id: int) -> int:
    result = await db.execute(
        select(func.count()).where(
            and_(CheckIn.challenge_id == challenge_id, CheckIn.success == True)  # noqa: E712
        )
    )
    return result.scalar_one()


async def _suspicion_reasons(
    db: AsyncSession,
    user_id: int,
    challenge: Challenge,
    body: CheckInRequest,
    now: datetime,
    distance: float,
) -> list[str]:
    reasons: list[str] = []
    if body.position.accuracy_m > settings.max_accuracy_m:
        reasons.append(f"GPS-Genauigkeit zu schlecht ({body.position.accuracy_m:.0f} m)")
    elif body.position.accuracy_m > min(settings.max_accuracy_m * 0.75, challenge.place.radius_m * 1.5):
        reasons.append(f"GPS-Genauigkeit auffällig ({body.position.accuracy_m:.0f} m)")
    if distance > challenge.place.radius_m * 10:
        reasons.append(f"Sehr weit außerhalb ({distance:.0f} m)")
    if body.client_ts:
        client_ts = body.client_ts.replace(tzinfo=UTC) if body.client_ts.tzinfo is None else body.client_ts
        drift_seconds = abs((now - client_ts).total_seconds())
        if drift_seconds > 600:
            reasons.append("Client-Zeit weicht mehr als 10 Minuten ab")

    previous_result = await db.execute(
        select(CheckIn)
        .options(selectinload(CheckIn.challenge).selectinload(Challenge.place))
        .where(
            and_(
                CheckIn.user_id == user_id,
                CheckIn.success == True,  # noqa: E712
            )
        )
        .order_by(CheckIn.checked_in_at.desc())
        .limit(1)
    )
    previous = previous_result.scalar_one_or_none()
    if previous and previous.challenge_id != challenge.id:
        previous_time = previous.checked_in_at.replace(tzinfo=UTC) if previous.checked_in_at.tzinfo is None else previous.checked_in_at
        hours = (now - previous_time).total_seconds() / 3600
        if hours <= 0:
            reasons.append("Check-in-Zeit liegt vor dem letzten erfolgreichen Check-in")
        else:
            place_distance_km = haversine(
                previous.challenge.place.lat,
                previous.challenge.place.lon,
                challenge.place.lat,
                challenge.place.lon,
            ) / 1000
            speed_kmh = place_distance_km / hours
            if speed_kmh > 35:
                reasons.append(f"Unplausible Geschwindigkeit seit letztem Check-in ({speed_kmh:.0f} km/h)")
    return reasons


@router.post("", response_model=CheckInResponse)
@limiter.limit("10/minute")
async def submit_checkin(
    request: Request,
    body: CheckInRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.consent_given:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Datenschutz-Einwilligung fehlt",
        )

    result = await db.execute(
        select(Challenge)
        .options(selectinload(Challenge.place))
        .where(Challenge.id == body.challenge_id)
    )
    challenge = result.scalar_one_or_none()
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge nicht gefunden")

    now = datetime.now(UTC)
    start = challenge.start_at.replace(tzinfo=UTC) if challenge.start_at.tzinfo is None else challenge.start_at

    if not challenge.is_active:
        return CheckInResponse(success=False, message="Challenge ist nicht aktiv")
    if start > now:
        return CheckInResponse(success=False, message="Challenge ist noch nicht freigeschaltet")

    if await already_checked_in_today(db, current_user.id, body.challenge_id):
        return CheckInResponse(success=False, message="Du hast diese Challenge bereits abgeschlossen")

    # Mystery-Rate-Limit: max. MYSTERY_DAILY_LIMIT Fehlversuche pro Tag
    mystery_attempts_today = 0
    if challenge.is_mystery:
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        mystery_attempts_today = (await db.execute(
            select(func.count()).where(
                CheckIn.user_id == current_user.id,
                CheckIn.challenge_id == challenge.id,
                CheckIn.success == False,  # noqa: E712
                CheckIn.checked_in_at >= today_start,
            )
        )).scalar_one()
        if mystery_attempts_today >= MYSTERY_DAILY_LIMIT:
            return CheckInResponse(
                success=False,
                message="Heute keine Versuche mehr übrig. Morgen kannst du es wieder versuchen!",
                attempts_left=0,
            )

    distance = haversine(
        body.position.lat, body.position.lon,
        challenge.place.lat, challenge.place.lon,
    )
    flag_reasons = await _suspicion_reasons(db, current_user.id, challenge, body, now, distance)
    is_flagged = len(flag_reasons) > 0
    flag_reason = "; ".join(flag_reasons) if flag_reasons else None

    def _attempts_left(extra: int = 0) -> int | None:
        if not challenge.is_mystery:
            return None
        return max(0, MYSTERY_DAILY_LIMIT - mystery_attempts_today - extra)

    if body.position.accuracy_m > settings.max_accuracy_m:
        db.add(CheckIn(
            user_id=current_user.id,
            challenge_id=challenge.id,
            success=False,
            points_awarded=0,
            distance_m=round(distance),
            accuracy_m=round(body.position.accuracy_m),
            is_flagged=True,
            flag_reason=flag_reason,
        ))
        return CheckInResponse(
            success=False,
            message=f"Standort zu ungenau ({body.position.accuracy_m:.0f} m). Bitte warte auf besseres GPS-Signal.",
            distance_m=round(distance),
            is_flagged=True,
            attempts_left=_attempts_left(1),
        )

    if distance > challenge.place.radius_m:
        db.add(CheckIn(
            user_id=current_user.id,
            challenge_id=challenge.id,
            success=False,
            points_awarded=0,
            distance_m=round(distance),
            accuracy_m=round(body.position.accuracy_m),
            is_flagged=is_flagged,
            flag_reason=flag_reason,
        ))
        return CheckInResponse(
            success=False,
            message=f"Du bist noch {distance - challenge.place.radius_m:.0f} m vom Ziel entfernt.",
            distance_m=round(distance),
            is_flagged=is_flagged,
            attempts_left=_attempts_left(1),
        )

    # ── Quiz-Validierung ──────────────────────────────────────────────────
    quiz_penalty = 0
    quiz_attempt = None
    if challenge.quiz_question and challenge.quiz_correct_index is not None:
        if body.quiz_answer_index is None:
            return CheckInResponse(success=False, message="Bitte wähle zuerst eine Antwort aus.")

        attempt_result = await db.execute(
            select(QuizAttempt).where(
                QuizAttempt.user_id == current_user.id,
                QuizAttempt.challenge_id == challenge.id,
            )
        )
        quiz_attempt = attempt_result.scalar_one_or_none()
        wrong_count = quiz_attempt.wrong_count if quiz_attempt else 0

        if body.quiz_answer_index != challenge.quiz_correct_index:
            if quiz_attempt:
                quiz_attempt.wrong_count += 1
            else:
                quiz_attempt = QuizAttempt(
                    user_id=current_user.id, challenge_id=challenge.id, wrong_count=1
                )
                db.add(quiz_attempt)
            db.add(CheckIn(
                user_id=current_user.id,
                challenge_id=challenge.id,
                success=False,
                points_awarded=0,
                distance_m=round(distance),
                accuracy_m=round(body.position.accuracy_m),
                is_flagged=is_flagged,
                flag_reason=flag_reason,
            ))
            return CheckInResponse(
                success=False,
                message="Falsche Antwort! Versuche es nochmal. Jeder Fehlversuch zieht 3 Punkte ab.",
            )

        quiz_penalty = wrong_count * 3

    # ── Bonus-Berechnung vor dem Speichern ────────────────────────────────
    bonuses: list[BonusInfo] = []

    is_right_day = (now.date() - start.date()).days <= 1

    # Erster weltweiter Check-in auf diese Challenge?
    existing_count = await _count_successful_checkins(db, challenge.id)
    if existing_count == 0:
        bonuses.append(BonusInfo(
            points=settings.bonus_first_checkin,
            reason=f"Erster Check-in! +{settings.bonus_first_checkin}",
        ))

    if is_right_day:
        bonuses.append(BonusInfo(
            points=settings.bonus_first_day,
            reason=f"Früh dabei! +{settings.bonus_first_day}",
        ))

    bonus_total = sum(b.points for b in bonuses)
    total_points = max(0, challenge.points + bonus_total - quiz_penalty)

    db.add(CheckIn(
        user_id=current_user.id,
        challenge_id=challenge.id,
        success=True,
        points_awarded=total_points,
        distance_m=round(distance),
        accuracy_m=round(body.position.accuracy_m),
        is_flagged=is_flagged,
        flag_reason=flag_reason,
    ))
    current_user.points += total_points

    if quiz_attempt is not None:
        await db.delete(quiz_attempt)

    challenges_router._counts_cache_ts = 0.0  # Cache invalidieren

    await db.flush()
    new_badges = await award_badges(db, current_user)

    return CheckInResponse(
        success=True,
        message="Check-in erfolgreich! Gut gemacht!",
        points_awarded=total_points,
        bonuses=bonuses,
        badges_unlocked=[BadgeOut.model_validate(b) for b in new_badges],
        distance_m=round(distance),
        is_flagged=is_flagged,
    )


@router.get("/my", response_model=list[dict])
async def my_checkins(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(CheckIn)
        .options(selectinload(CheckIn.challenge).selectinload(Challenge.place))
        .where(and_(CheckIn.user_id == current_user.id, CheckIn.success == True))  # noqa: E712
        .order_by(CheckIn.checked_in_at.desc())
    )
    checkins = result.scalars().all()
    return [
        {
            "id": c.id,
            "challenge_id": c.challenge_id,
            "challenge_title": c.challenge.title,
            "place_title": c.challenge.place.title,
            "checked_in_at": c.checked_in_at.isoformat(),
            "distance_m": c.distance_m,
            "points_awarded": c.points_awarded,
        }
        for c in checkins
    ]
