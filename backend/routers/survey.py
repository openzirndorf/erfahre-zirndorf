from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_admin_user, get_optional_user
from database import get_db
from models import SurveyResponse, User

router = APIRouter(prefix="/api/survey", tags=["survey"])


class SurveySubmit(BaseModel):
    q1: str | None = None  # Wo hast du von der App erfahren?
    q2: str | None = None  # Warum machst du mit?
    q3: str | None = None  # Teams interessant?
    q4: str | None = None  # Quize/Aufgaben interessant?
    q5: str | None = None  # Freier Wunsch


class SurveyResultEntry(BaseModel):
    id: int
    q1: str | None
    q2: str | None
    q3: str | None
    q4: str | None
    q5: str | None
    created_at: str


@router.post("", status_code=201)
async def submit_survey(
    body: SurveySubmit,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    if current_user:
        existing = (await db.execute(
            select(SurveyResponse).where(SurveyResponse.user_id == current_user.id)
        )).scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=409, detail="Umfrage bereits ausgefüllt.")

    db.add(SurveyResponse(
        user_id=current_user.id if current_user else None,
        q1=body.q1,
        q2=body.q2,
        q3=body.q3,
        q4=body.q4,
        q5=body.q5 or None,
    ))
    await db.commit()
    return {"ok": True}


@router.get("/results", response_model=list[SurveyResultEntry])
async def survey_results(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    rows = (await db.execute(
        select(SurveyResponse).order_by(SurveyResponse.created_at.desc())
    )).scalars().all()
    return [
        SurveyResultEntry(
            id=r.id,
            q1=r.q1,
            q2=r.q2,
            q3=r.q3,
            q4=r.q4,
            q5=r.q5,
            created_at=(r.created_at if r.created_at.tzinfo else r.created_at.replace(tzinfo=UTC)).isoformat(),
        )
        for r in rows
    ]
