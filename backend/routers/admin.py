import asyncio
import json
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_serializer
from sqlalchemy import and_, delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from auth import get_admin_user
from config import settings
from database import get_db
from models import AdminAuditLog, Badge, BadgeRuleType, Challenge, CheckIn, Place, Suggestion, SurveyResponse, User, UserBadge, UserRole

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ── Schemas ────────────────────────────────────────────────────────────────


class PlaceCreate(BaseModel):
    title: str
    description: str | None = None
    lat: float
    lon: float
    radius_m: float = 75.0
    category: str | None = None
    image_url: str | None = None


class PlaceUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    lat: float | None = None
    lon: float | None = None
    radius_m: float | None = None
    category: str | None = None
    image_url: str | None = None


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


class ChallengeCreate(BaseModel):
    place_id: int
    title: str
    description: str
    story: str | None = None
    day_number: int | None = None
    start_at: datetime
    end_at: datetime
    points: int = 20
    category: str | None = None
    is_active: bool = True


class ChallengeUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    story: str | None = None
    day_number: int | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None
    points: int | None = None
    category: str | None = None
    is_active: bool | None = None


class ChallengeOut(BaseModel):
    id: int
    place_id: int
    title: str
    description: str
    day_number: int | None
    start_at: datetime
    end_at: datetime
    points: int
    category: str | None
    is_active: bool
    story: str | None

    model_config = {"from_attributes": True}

    @field_serializer("start_at", "end_at")
    def serialize_dt(self, dt: datetime) -> str:
        return (dt if dt.tzinfo is not None else dt.replace(tzinfo=UTC)).isoformat()


class BadgeCreate(BaseModel):
    title: str
    description: str
    icon: str = "🏅"
    rule_type: BadgeRuleType
    rule_value: str


def _utc_iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    return (dt if dt.tzinfo is not None else dt.replace(tzinfo=UTC)).isoformat()


class FlaggedCheckIn(BaseModel):
    id: int
    user_id: int
    user_display_name: str
    challenge_id: int
    challenge_title: str
    checked_in_at: datetime
    success: bool
    points_awarded: int
    distance_m: float | None
    accuracy_m: float | None
    is_flagged: bool
    flag_reason: str | None

    @field_serializer("checked_in_at")
    def _ser(self, v: datetime) -> str:
        return _utc_iso(v)


class CheckInReviewRequest(BaseModel):
    is_flagged: bool
    flag_reason: str | None = None
    approve: bool = True


class UserUpdate(BaseModel):
    email: str | None = None
    display_name: str | None = None
    points: int | None = None
    manual_checkin_count: int | None = None
    target_checkin_count: int | None = None  # setzt manual_checkin_count = target - echte Check-ins
    role: UserRole | None = None
    is_blocked: bool | None = None
    blocked_reason: str | None = None


class UserOut(BaseModel):
    id: int
    email: str
    display_name: str
    points: int
    manual_checkin_count: int
    checkin_count: int = 0
    role: UserRole
    is_blocked: bool
    blocked_reason: str | None
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_serializer("created_at")
    def _ser(self, v: datetime) -> str:
        return _utc_iso(v)


class ResetCheckInsRequest(BaseModel):
    challenge_id: int | None = None


class ResetCheckInsResponse(BaseModel):
    deleted_checkins: int
    points: int


class AuditLogOut(BaseModel):
    id: int
    admin_user_id: int | None
    target_user_id: int | None
    admin_display_name: str | None
    action: str
    details: str | None
    created_at: datetime

    @field_serializer("created_at")
    def _ser(self, v: datetime) -> str:
        return _utc_iso(v)


class UserDetailCheckIn(BaseModel):
    id: int
    challenge_id: int
    challenge_title: str
    checked_in_at: datetime
    success: bool
    points_awarded: int
    distance_m: float | None
    accuracy_m: float | None
    is_flagged: bool
    flag_reason: str | None

    @field_serializer("checked_in_at")
    def _ser(self, v: datetime) -> str:
        return _utc_iso(v)


class UserDetailBadge(BaseModel):
    id: int
    title: str
    icon: str
    awarded_at: datetime

    @field_serializer("awarded_at")
    def _ser(self, v: datetime) -> str:
        return _utc_iso(v)


class UserDetailOut(BaseModel):
    user: UserOut
    checkins: list[UserDetailCheckIn]
    badges: list[UserDetailBadge]
    audit_log: list[AuditLogOut]


class HealthStatusOut(BaseModel):
    api: str
    database: str
    event_status: str
    event_start: str
    event_end: str
    server_time: datetime
    users: int
    successful_checkins: int
    flagged_checkins: int
    challenges: int
    active_challenges: int
    last_checkin_at: datetime | None

    @field_serializer("server_time", "last_checkin_at")
    def _ser(self, v: datetime | None) -> str | None:
        return _utc_iso(v)


async def _log_admin_action(
    db: AsyncSession,
    admin: User,
    action: str,
    target_user_id: int | None = None,
    details: str | None = None,
) -> None:
    db.add(AdminAuditLog(
        admin_user_id=admin.id,
        target_user_id=target_user_id,
        action=action,
        details=details,
    ))


async def _recalculate_user_progress(db: AsyncSession, user: User) -> None:
    points_result = await db.execute(
        select(func.coalesce(func.sum(CheckIn.points_awarded), 0))
        .where(
            CheckIn.user_id == user.id,
            CheckIn.success == True,  # noqa: E712
        )
    )
    user.points = int(points_result.scalar_one() or 0)
    await db.execute(delete(UserBadge).where(UserBadge.user_id == user.id))


# ── Places ─────────────────────────────────────────────────────────────────


@router.get("/places", response_model=list[PlaceOut])
async def list_places(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    result = await db.execute(select(Place).order_by(Place.title))
    return result.scalars().all()


@router.post("/places", response_model=PlaceOut, status_code=201)
async def create_place(
    body: PlaceCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    place = Place(**body.model_dump())
    db.add(place)
    await db.flush()
    return place


@router.patch("/places/{place_id}", response_model=PlaceOut)
async def update_place(
    place_id: int,
    body: PlaceUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    result = await db.execute(select(Place).where(Place.id == place_id))
    place = result.scalar_one_or_none()
    if not place:
        raise HTTPException(status_code=404, detail="Ort nicht gefunden")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(place, k, v)
    return place


# ── Challenges ─────────────────────────────────────────────────────────────


@router.get("/challenges", response_model=list[ChallengeOut])
async def list_challenges(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    result = await db.execute(select(Challenge).order_by(Challenge.day_number, Challenge.start_at))
    return result.scalars().all()


@router.get("/challenges/upcoming", response_model=list[ChallengeOut])
async def upcoming_challenges(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    now = datetime.now(UTC)
    result = await db.execute(
        select(Challenge)
        .where(Challenge.is_active == True, Challenge.start_at > now)  # noqa: E712
        .order_by(Challenge.start_at)
    )
    return result.scalars().all()


@router.post("/challenges", response_model=ChallengeOut, status_code=201)
async def create_challenge(
    body: ChallengeCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    challenge = Challenge(**body.model_dump())
    db.add(challenge)
    await db.flush()
    return challenge


class ChallengeCheckInEntry(BaseModel):
    id: int
    user_id: int
    user_display_name: str
    checked_in_at: datetime
    points_awarded: int
    distance_m: float | None
    accuracy_m: float | None
    is_flagged: bool

    @field_serializer("checked_in_at")
    def _ser(self, v: datetime) -> str:
        return _utc_iso(v)


@router.get("/challenges/{challenge_id}/checkins", response_model=list[ChallengeCheckInEntry])
async def challenge_checkins(
    challenge_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    result = await db.execute(
        select(CheckIn)
        .options(selectinload(CheckIn.user))
        .where(CheckIn.challenge_id == challenge_id, CheckIn.success == True)  # noqa: E712
        .order_by(CheckIn.checked_in_at.asc())
    )
    return [
        ChallengeCheckInEntry(
            id=c.id,
            user_id=c.user_id,
            user_display_name=c.user.display_name,
            checked_in_at=c.checked_in_at,
            points_awarded=c.points_awarded,
            distance_m=c.distance_m,
            accuracy_m=c.accuracy_m,
            is_flagged=c.is_flagged,
        )
        for c in result.scalars().all()
    ]


@router.patch("/challenges/{challenge_id}", response_model=ChallengeOut)
async def update_challenge(
    challenge_id: int,
    body: ChallengeUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    result = await db.execute(select(Challenge).where(Challenge.id == challenge_id))
    challenge = result.scalar_one_or_none()
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge nicht gefunden")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(challenge, k, v)
    return challenge


# ── Check-ins (Moderation) ─────────────────────────────────────────────────


@router.get("/checkins/flagged", response_model=list[FlaggedCheckIn])
async def flagged_checkins(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    result = await db.execute(
        select(CheckIn)
        .options(selectinload(CheckIn.user), selectinload(CheckIn.challenge))
        .where(CheckIn.is_flagged == True)  # noqa: E712
        .order_by(CheckIn.checked_in_at.desc())
        .limit(100)
    )
    checkins = result.scalars().all()
    return [
        FlaggedCheckIn(
            id=c.id,
            user_id=c.user_id,
            user_display_name=c.user.display_name,
            challenge_id=c.challenge_id,
            challenge_title=c.challenge.title,
            checked_in_at=c.checked_in_at,
            success=c.success,
            points_awarded=c.points_awarded,
            distance_m=c.distance_m,
            accuracy_m=c.accuracy_m,
            is_flagged=c.is_flagged,
            flag_reason=c.flag_reason,
        )
        for c in checkins
    ]


@router.patch("/checkins/{checkin_id}/review", response_model=FlaggedCheckIn)
async def review_checkin(
    checkin_id: int,
    body: CheckInReviewRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    result = await db.execute(
        select(CheckIn)
        .options(selectinload(CheckIn.user), selectinload(CheckIn.challenge))
        .where(CheckIn.id == checkin_id)
    )
    checkin = result.scalar_one_or_none()
    if not checkin:
        raise HTTPException(status_code=404, detail="Check-in nicht gefunden")

    checkin.is_flagged = body.is_flagged
    checkin.flag_reason = body.flag_reason if body.is_flagged else None

    if not body.is_flagged and body.approve and not checkin.success:
        checkin.success = True
        checkin.points_awarded = checkin.challenge.points
        checkin.user.points += checkin.challenge.points

    await _log_admin_action(
        db,
        admin,
        "checkin_review",
        target_user_id=checkin.user_id,
        details=f"Check-in #{checkin.id}: {'markiert' if checkin.is_flagged else 'freigegeben'}"
        + (f" ({checkin.flag_reason})" if checkin.flag_reason else ""),
    )
    await db.commit()
    return FlaggedCheckIn(
        id=checkin.id,
        user_id=checkin.user_id,
        user_display_name=checkin.user.display_name,
        challenge_id=checkin.challenge_id,
        challenge_title=checkin.challenge.title,
        checked_in_at=checkin.checked_in_at,
        success=checkin.success,
        points_awarded=checkin.points_awarded,
        distance_m=checkin.distance_m,
        accuracy_m=checkin.accuracy_m,
        is_flagged=checkin.is_flagged,
        flag_reason=checkin.flag_reason,
    )


# ── Badges ──────────────────────────────────────────────────────────────────


@router.post("/badges", status_code=201)
async def create_badge(
    body: BadgeCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    badge = Badge(**body.model_dump())
    db.add(badge)
    await db.flush()
    return {"id": badge.id, "title": badge.title}


# ── User-Management ─────────────────────────────────────────────────────────


@router.get("/users", response_model=list[UserOut])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    rows = (await db.execute(
        select(User, func.count(CheckIn.id).label("checkin_count"))
        .outerjoin(CheckIn, (CheckIn.user_id == User.id) & (CheckIn.success == True))  # noqa: E712
        .group_by(User.id)
        .order_by(User.created_at.desc())
        .limit(200)
    )).all()
    return [
        UserOut(**{c: getattr(u, c) for c in User.__table__.columns.keys()}, checkin_count=cnt)
        for u, cnt in rows
    ]


@router.get("/users/{user_id}", response_model=UserDetailOut)
async def user_detail(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Nutzer nicht gefunden")

    checkins_result = await db.execute(
        select(CheckIn)
        .options(selectinload(CheckIn.challenge))
        .where(CheckIn.user_id == user_id)
        .order_by(CheckIn.checked_in_at.desc())
        .limit(100)
    )
    badge_result = await db.execute(
        select(UserBadge)
        .options(selectinload(UserBadge.badge))
        .where(UserBadge.user_id == user_id)
        .order_by(UserBadge.awarded_at.desc())
    )
    audit_result = await db.execute(
        select(AdminAuditLog, User.display_name)
        .join(User, AdminAuditLog.admin_user_id == User.id, isouter=True)
        .where(AdminAuditLog.target_user_id == user_id)
        .order_by(AdminAuditLog.created_at.desc())
        .limit(50)
    )

    return UserDetailOut(
        user=UserOut.model_validate(user),
        checkins=[
            UserDetailCheckIn(
                id=c.id,
                challenge_id=c.challenge_id,
                challenge_title=c.challenge.title,
                checked_in_at=c.checked_in_at,
                success=c.success,
                points_awarded=c.points_awarded,
                distance_m=c.distance_m,
                accuracy_m=c.accuracy_m,
                is_flagged=c.is_flagged,
                flag_reason=c.flag_reason,
            )
            for c in checkins_result.scalars().all()
        ],
        badges=[
            UserDetailBadge(
                id=ub.badge.id,
                title=ub.badge.title,
                icon=ub.badge.icon,
                awarded_at=ub.awarded_at,
            )
            for ub in badge_result.scalars().all()
        ],
        audit_log=[
            AuditLogOut(
                id=entry.id,
                admin_user_id=entry.admin_user_id,
                target_user_id=entry.target_user_id,
                admin_display_name=admin_display_name,
                action=entry.action,
                details=entry.details,
                created_at=entry.created_at,
            )
            for entry, admin_display_name in audit_result.all()
        ],
    )


@router.patch("/users/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int,
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Nutzer nicht gefunden")
    if user.id == admin.id and body.is_blocked is True:
        raise HTTPException(status_code=422, detail="Du kannst dich nicht selbst sperren.")
    if user.id == admin.id and body.role is not None and body.role != UserRole.ADMIN:
        raise HTTPException(status_code=422, detail="Du kannst dir nicht selbst die Admin-Rolle entziehen.")

    update_data = body.model_dump(exclude_unset=True)
    if "target_checkin_count" in update_data:
        target = update_data.pop("target_checkin_count")
        actual = (await db.execute(
            select(func.count()).where(CheckIn.user_id == user.id, CheckIn.success == True)  # noqa: E712
        )).scalar_one()
        update_data["manual_checkin_count"] = target - actual
    for k, v in update_data.items():
        setattr(user, k, v)
    if user.is_blocked and not user.blocked_reason:
        user.blocked_reason = "Dein Account wurde gesperrt. Bitte wende dich an OpenZirndorf."
    if not user.is_blocked:
        user.blocked_reason = None
    await _log_admin_action(
        db,
        admin,
        "user_update",
        target_user_id=user.id,
        details=f"Nutzer aktualisiert: Rolle={user.role}, Punkte={user.points}, gesperrt={user.is_blocked}",
    )
    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Nutzer nicht gefunden")
    if user.id == admin.id:
        raise HTTPException(status_code=422, detail="Du kannst deinen eigenen Account nicht löschen.")
    await db.execute(delete(UserBadge).where(UserBadge.user_id == user_id))
    await db.execute(delete(CheckIn).where(CheckIn.user_id == user_id))
    await db.execute(update(AdminAuditLog).where(AdminAuditLog.target_user_id == user.id).values(target_user_id=None))
    await db.execute(update(AdminAuditLog).where(AdminAuditLog.admin_user_id == user.id).values(admin_user_id=None))
    await _log_admin_action(db, admin, "user_delete", details=f"Nutzer gelöscht: #{user.id} {user.display_name}")
    await db.delete(user)


@router.post("/users/{user_id}/reset-checkins", response_model=ResetCheckInsResponse)
async def reset_user_checkins(
    user_id: int,
    body: ResetCheckInsRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Nutzer nicht gefunden")

    conditions = [CheckIn.user_id == user_id]
    if body.challenge_id is not None:
        conditions.append(CheckIn.challenge_id == body.challenge_id)

    count_result = await db.execute(
        select(func.count()).select_from(CheckIn).where(and_(*conditions))
    )
    deleted_count = int(count_result.scalar_one())
    await db.execute(delete(CheckIn).where(and_(*conditions)))
    await _recalculate_user_progress(db, user)
    await _log_admin_action(
        db,
        admin,
        "checkins_reset",
        target_user_id=user.id,
        details=f"{deleted_count} Check-ins zurückgesetzt"
        + (f" für Challenge #{body.challenge_id}" if body.challenge_id is not None else ""),
    )

    return ResetCheckInsResponse(deleted_checkins=deleted_count, points=user.points)


@router.patch("/users/{user_id}/promote")
async def promote_to_admin(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Nutzer nicht gefunden")
    if user.is_blocked:
        raise HTTPException(status_code=422, detail="Gesperrte Nutzer können nicht befördert werden.")
    user.role = UserRole.ADMIN
    await _log_admin_action(db, admin, "user_promote", target_user_id=user.id, details="Nutzer zu Admin befördert")
    return {"message": f"{user.display_name} ist jetzt Admin"}


@router.get("/audit-log", response_model=list[AuditLogOut])
async def audit_log(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    result = await db.execute(
        select(AdminAuditLog, User.display_name)
        .join(User, AdminAuditLog.admin_user_id == User.id, isouter=True)
        .order_by(AdminAuditLog.created_at.desc())
        .limit(100)
    )
    return [
        AuditLogOut(
            id=entry.id,
            admin_user_id=entry.admin_user_id,
            target_user_id=entry.target_user_id,
            admin_display_name=admin_display_name,
            action=entry.action,
            details=entry.details,
            created_at=entry.created_at,
        )
        for entry, admin_display_name in result.all()
    ]


# ── Progress / Users/me ────────────────────────────────────────────────────


@router.get("/stats")
async def event_stats(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    now = datetime.now(UTC)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_start = today_start.replace(day=today_start.day - 1) if today_start.day > 1 else (
        today_start.replace(month=today_start.month - 1, day=28) if today_start.month > 1
        else today_start.replace(year=today_start.year - 1, month=12, day=31)
    )

    user_count, checkin_count, challenge_count, flagged_count, \
        checkins_today, checkins_yesterday, total_points, unanswered_support = await asyncio.gather(
        db.execute(select(func.count()).select_from(User)),
        db.execute(select(func.count()).select_from(CheckIn).where(CheckIn.success == True)),  # noqa: E712
        db.execute(select(func.count()).select_from(Challenge)),
        db.execute(select(func.count()).select_from(CheckIn).where(CheckIn.is_flagged == True)),  # noqa: E712
        db.execute(select(func.count()).select_from(CheckIn).where(
            CheckIn.success == True, CheckIn.checked_in_at >= today_start)),  # noqa: E712
        db.execute(select(func.count()).select_from(CheckIn).where(
            CheckIn.success == True,  # noqa: E712
            CheckIn.checked_in_at >= yesterday_start,
            CheckIn.checked_in_at < today_start,
        )),
        db.execute(select(func.coalesce(func.sum(CheckIn.points_awarded), 0)).where(CheckIn.success == True)),  # noqa: E712
        db.execute(select(func.count()).select_from(Suggestion).where(
            Suggestion.type == "support", Suggestion.admin_reply == None)),  # noqa: E711
    )
    return {
        "users": user_count.scalar_one(),
        "successful_checkins": checkin_count.scalar_one(),
        "challenges": challenge_count.scalar_one(),
        "flagged_checkins": flagged_count.scalar_one(),
        "checkins_today": checkins_today.scalar_one(),
        "checkins_yesterday": checkins_yesterday.scalar_one(),
        "total_points": int(total_points.scalar_one()),
        "unanswered_support": unanswered_support.scalar_one(),
    }


@router.get("/health-status", response_model=HealthStatusOut)
async def health_status(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    now = datetime.now(UTC)
    event_start = datetime.fromisoformat(settings.event_start).date()
    event_end = datetime.fromisoformat(settings.event_end).date()
    if now.date() < event_start:
        event_status = "upcoming"
    elif now.date() > event_end:
        event_status = "ended"
    else:
        event_status = "active"

    users = (await db.execute(select(func.count()).select_from(User))).scalar_one()
    successful_checkins = (
        await db.execute(select(func.count()).select_from(CheckIn).where(CheckIn.success == True))  # noqa: E712
    ).scalar_one()
    flagged_checkins = (
        await db.execute(select(func.count()).select_from(CheckIn).where(CheckIn.is_flagged == True))  # noqa: E712
    ).scalar_one()
    challenges = (await db.execute(select(func.count()).select_from(Challenge))).scalar_one()
    active_challenges = (
        await db.execute(select(func.count()).select_from(Challenge).where(Challenge.is_active == True))  # noqa: E712
    ).scalar_one()
    last_checkin_at = (
        await db.execute(select(func.max(CheckIn.checked_in_at)).select_from(CheckIn))
    ).scalar_one()

    return HealthStatusOut(
        api="ok",
        database="ok",
        event_status=event_status,
        event_start=settings.event_start,
        event_end=settings.event_end,
        server_time=now,
        users=users,
        successful_checkins=successful_checkins,
        flagged_checkins=flagged_checkins,
        challenges=challenges,
        active_challenges=active_challenges,
        last_checkin_at=last_checkin_at,
    )


# ── DB-Export ───────────────────────────────────────────────────────────────


def _dt(v: datetime | None) -> str | None:
    if v is None:
        return None
    return (v if v.tzinfo is not None else v.replace(tzinfo=UTC)).isoformat()


@router.get("/export")
async def export_db(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Exportiert alle relevanten Tabellen als JSON-Datei (ohne Auth-Token-Felder)."""
    users_rows = (await db.execute(select(User).order_by(User.id))).scalars().all()
    checkins_rows = (await db.execute(select(CheckIn).order_by(CheckIn.id))).scalars().all()
    user_badges_rows = (await db.execute(select(UserBadge).order_by(UserBadge.id))).scalars().all()
    audit_rows = (await db.execute(select(AdminAuditLog).order_by(AdminAuditLog.id))).scalars().all()

    payload = {
        "exported_at": datetime.now(UTC).isoformat(),
        "users": [
            {
                "id": u.id,
                "email": u.email,
                "display_name": u.display_name,
                "role": u.role,
                "points": u.points,
                "consent_given": u.consent_given,
                "is_blocked": u.is_blocked,
                "blocked_reason": u.blocked_reason,
                "created_at": _dt(u.created_at),
            }
            for u in users_rows
        ],
        "checkins": [
            {
                "id": c.id,
                "user_id": c.user_id,
                "challenge_id": c.challenge_id,
                "checked_in_at": _dt(c.checked_in_at),
                "success": c.success,
                "points_awarded": c.points_awarded,
                "distance_m": c.distance_m,
                "accuracy_m": c.accuracy_m,
                "is_flagged": c.is_flagged,
                "flag_reason": c.flag_reason,
            }
            for c in checkins_rows
        ],
        "user_badges": [
            {"id": ub.id, "user_id": ub.user_id, "badge_id": ub.badge_id, "awarded_at": _dt(ub.awarded_at)}
            for ub in user_badges_rows
        ],
        "audit_log": [
            {
                "id": a.id,
                "admin_user_id": a.admin_user_id,
                "target_user_id": a.target_user_id,
                "action": a.action,
                "details": a.details,
                "created_at": _dt(a.created_at),
            }
            for a in audit_rows
        ],
    }

    date_str = datetime.now(UTC).strftime("%Y-%m-%d")
    filename = f"erfahre-backup-{date_str}.json"
    content = json.dumps(payload, ensure_ascii=False, indent=2)

    return StreamingResponse(
        iter([content]),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/suggestions")
async def list_suggestions(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    rows = (await db.execute(
        select(Suggestion, User.display_name)
        .join(User, Suggestion.user_id == User.id)
        .order_by(Suggestion.created_at.desc())
    )).all()
    return [
        {
            "id": s.id,
            "user_id": s.user_id,
            "type": s.type,
            "text": s.text,
            "lat": s.lat,
            "lon": s.lon,
            "image_base64": s.image_base64,
            "admin_reply": s.admin_reply,
            "admin_reply_at": _dt(s.admin_reply_at),
            "created_at": _dt(s.created_at),
            "user_display_name": name,
        }
        for s, name in rows
    ]


class SuggestionReplyRequest(BaseModel):
    reply: str


@router.post("/suggestions/{suggestion_id}/reply")
async def reply_to_suggestion(
    suggestion_id: int,
    body: SuggestionReplyRequest,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    suggestion = await db.get(Suggestion, suggestion_id)
    if not suggestion:
        raise HTTPException(status_code=404, detail="Nicht gefunden")
    suggestion.admin_reply = body.reply.strip()
    suggestion.admin_reply_at = datetime.now(UTC)
    await db.commit()
    return {"ok": True}


@router.delete("/suggestions/{suggestion_id}", status_code=204)
async def delete_suggestion(
    suggestion_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    suggestion = await db.get(Suggestion, suggestion_id)
    if not suggestion:
        raise HTTPException(status_code=404, detail="Nicht gefunden")
    await db.delete(suggestion)
    await db.commit()


@router.get("/survey/results")
async def survey_results(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    rows = (await db.execute(
        select(SurveyResponse).order_by(SurveyResponse.created_at.desc())
    )).scalars().all()
    return [
        {
            "id": r.id,
            "q1": r.q1,
            "q2": r.q2,
            "q3": r.q3,
            "q4": r.q4,
            "q5": r.q5,
            "created_at": _dt(r.created_at),
        }
        for r in rows
    ]
