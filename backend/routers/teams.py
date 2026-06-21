from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import CheckIn, User

router = APIRouter(prefix="/api/ranking", tags=["ranking"])


class UserRankEntry(BaseModel):
    rank: int
    user_id: int
    display_name: str
    points: int
    checkin_count: int


@router.get("", response_model=list[UserRankEntry])
async def user_ranking(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(
            User.id,
            User.display_name,
            User.points,
            User.manual_checkin_count,
            func.count(CheckIn.id).label("checkin_count"),
        )
        .outerjoin(CheckIn, (CheckIn.user_id == User.id) & (CheckIn.success == True))  # noqa: E712
        .group_by(User.id)
        .order_by(User.points.desc(), func.count(CheckIn.id).desc())
        .limit(50)
    )
    rows = result.all()
    ranking = []
    for idx, r in enumerate(rows):
        rank = idx + 1 if idx == 0 or r.points < rows[idx - 1].points else ranking[-1].rank
        ranking.append(UserRankEntry(
            rank=rank,
            user_id=r.id,
            display_name=r.display_name,
            points=r.points,
            checkin_count=r.checkin_count + r.manual_checkin_count,
        ))
    return ranking
