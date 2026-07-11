from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy import and_, delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from auth import get_current_user
from database import get_db
from models import Badge, CheckIn, Prize, Suggestion, SurveyResponse, User, UserBadge

router = APIRouter(prefix="/api/users", tags=["users"])


class BadgeOut(BaseModel):
    id: int
    title: str
    icon: str
    description: str
    awarded_at: str

    model_config = {"from_attributes": True}


class UserProgress(BaseModel):
    user_id: int
    display_name: str
    points: int
    checkin_count: int
    badges: list[BadgeOut]
    referral_code: str | None = None
    referrals_registered: int = 0
    referrals_milestone: int = 0
    newsletter_consent: bool = False
    my_rating: int | None = None


@router.get("/me/progress", response_model=UserProgress)
async def my_progress(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    checkin_result = await db.execute(
        select(func.count()).where(
            and_(CheckIn.user_id == current_user.id, CheckIn.success == True)  # noqa: E712
        )
    )
    checkin_count = checkin_result.scalar_one()

    badge_result = await db.execute(
        select(UserBadge, Badge)
        .join(Badge, UserBadge.badge_id == Badge.id)
        .where(UserBadge.user_id == current_user.id)
        .order_by(UserBadge.awarded_at.desc())
    )
    badge_rows = badge_result.all()

    badges = [
        BadgeOut(
            id=b.id,
            title=b.title,
            icon=b.icon,
            description=b.description,
            awarded_at=ub.awarded_at.isoformat(),
        )
        for ub, b in badge_rows
    ]

    referrals_result = await db.execute(
        select(
            func.count().label("total"),
            func.count().filter(User.referral_milestone_paid == True).label("milestone"),  # noqa: E712
        ).where(User.referred_by_user_id == current_user.id)
    )
    referrals_row = referrals_result.one()

    survey_result = await db.execute(
        select(SurveyResponse.rating).where(SurveyResponse.user_id == current_user.id)
    )
    my_rating = survey_result.scalar_one_or_none()

    return UserProgress(
        user_id=current_user.id,
        display_name=current_user.display_name,
        points=current_user.points,
        checkin_count=checkin_count + current_user.manual_checkin_count,
        badges=badges,
        referral_code=current_user.referral_code,
        referrals_registered=referrals_row.total,
        referrals_milestone=referrals_row.milestone,
        newsletter_consent=current_user.newsletter_consent,
        my_rating=my_rating,
    )


class NewsletterConsentBody(BaseModel):
    consent: bool


@router.patch("/me/newsletter", status_code=status.HTTP_204_NO_CONTENT)
async def update_newsletter_consent(
    body: NewsletterConsentBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user.newsletter_consent = body.consent


class RatingBody(BaseModel):
    rating: int
    comment: str | None = None


@router.post("/me/rating", status_code=status.HTTP_204_NO_CONTENT)
async def submit_rating(
    body: RatingBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.rating < 1 or body.rating > 5:
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail="Rating must be 1–5")
    existing = (await db.execute(
        select(SurveyResponse).where(SurveyResponse.user_id == current_user.id)
    )).scalar_one_or_none()
    if existing:
        existing.rating = body.rating
        existing.rating_comment = body.comment
    else:
        db.add(SurveyResponse(user_id=current_user.id, rating=body.rating, rating_comment=body.comment))


@router.get("/me/prizes")
async def my_prizes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (await db.execute(
        select(Prize).where(Prize.user_id == current_user.id).order_by(Prize.awarded_at.desc())
    )).scalars().all()
    return [
        {
            "id": r.id,
            "title": r.title,
            "description": r.description,
            "sponsor": r.sponsor,
            "awarded_at": r.awarded_at.isoformat() if r.awarded_at else None,
            "user_claimed_at": r.user_claimed_at.isoformat() if r.user_claimed_at else None,
            "admin_confirmed_at": r.admin_confirmed_at.isoformat() if r.admin_confirmed_at else None,
        }
        for r in rows
    ]


@router.post("/me/prizes/{prize_id}/claim", status_code=status.HTTP_204_NO_CONTENT)
async def claim_prize(
    prize_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from fastapi import HTTPException
    from datetime import UTC, datetime
    prize = (await db.execute(
        select(Prize).where(Prize.id == prize_id, Prize.user_id == current_user.id)
    )).scalar_one_or_none()
    if not prize:
        raise HTTPException(status_code=404, detail="Gewinn nicht gefunden")
    if prize.user_claimed_at:
        raise HTTPException(status_code=409, detail="Bereits abgeholt")
    prize.user_claimed_at = datetime.now(UTC)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_my_account(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await db.execute(delete(UserBadge).where(UserBadge.user_id == current_user.id))
    await db.execute(delete(CheckIn).where(CheckIn.user_id == current_user.id))
    await db.execute(delete(Suggestion).where(Suggestion.user_id == current_user.id))
    await db.execute(delete(SurveyResponse).where(SurveyResponse.user_id == current_user.id))
    await db.delete(current_user)
