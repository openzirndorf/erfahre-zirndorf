from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from auth import get_current_user
from database import get_db
from models import Badge, CheckIn, User, UserBadge

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

    return UserProgress(
        user_id=current_user.id,
        display_name=current_user.display_name,
        points=current_user.points,
        checkin_count=checkin_count + current_user.manual_checkin_count,
        badges=badges,
    )
