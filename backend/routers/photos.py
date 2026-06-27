from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from auth import get_admin_user, get_current_user
from database import get_db
from models import Challenge, CheckIn, PhotoSubmission, User

router = APIRouter(prefix="/api/photos", tags=["photos"])


class PhotoSubmitRequest(BaseModel):
    image_base64: str


class PhotoReviewRequest(BaseModel):
    approved: bool
    message: str | None = None


class PhotoSubmissionOut(BaseModel):
    id: int
    user_id: int
    user_display_name: str
    challenge_id: int
    challenge_title: str
    status: str
    admin_message: str | None
    submitted_at: datetime
    image_base64: str


@router.post("/{challenge_id}", status_code=201)
async def submit_photo(
    challenge_id: int,
    body: PhotoSubmitRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    challenge = await db.get(Challenge, challenge_id)
    if not challenge or not challenge.is_photo:
        raise HTTPException(status_code=404, detail="Nicht gefunden")

    ci = (await db.execute(
        select(CheckIn).where(
            CheckIn.user_id == current_user.id,
            CheckIn.challenge_id == challenge_id,
            CheckIn.success == True,  # noqa: E712
        )
    )).scalar_one_or_none()
    if not ci:
        raise HTTPException(status_code=400, detail="Zuerst einchecken.")

    existing = (await db.execute(
        select(PhotoSubmission).where(
            PhotoSubmission.user_id == current_user.id,
            PhotoSubmission.challenge_id == challenge_id,
        )
    )).scalar_one_or_none()

    if existing and existing.status == "approved":
        raise HTTPException(status_code=400, detail="Foto bereits freigegeben.")

    if existing:
        existing.image_base64 = body.image_base64
        existing.status = "pending"
        existing.admin_message = None
        existing.submitted_at = datetime.now(UTC)
        existing.reviewed_at = None
    else:
        db.add(PhotoSubmission(
            user_id=current_user.id,
            challenge_id=challenge_id,
            image_base64=body.image_base64,
            status="pending",
        ))

    await db.commit()
    return {"status": "pending"}


@router.get("/admin/pending", response_model=list[PhotoSubmissionOut])
async def list_pending_photos(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    rows = (await db.execute(
        select(PhotoSubmission)
        .options(selectinload(PhotoSubmission.user), selectinload(PhotoSubmission.challenge))
        .where(PhotoSubmission.status == "pending")
        .order_by(PhotoSubmission.submitted_at.asc())
    )).scalars().all()
    return [
        PhotoSubmissionOut(
            id=ps.id,
            user_id=ps.user_id,
            user_display_name=ps.user.display_name,
            challenge_id=ps.challenge_id,
            challenge_title=ps.challenge.title,
            status=ps.status,
            admin_message=ps.admin_message,
            submitted_at=ps.submitted_at,
            image_base64=ps.image_base64,
        )
        for ps in rows
    ]


@router.patch("/admin/{submission_id}/review")
async def review_photo(
    submission_id: int,
    body: PhotoReviewRequest,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    ps = (await db.execute(
        select(PhotoSubmission)
        .options(selectinload(PhotoSubmission.user), selectinload(PhotoSubmission.challenge))
        .where(PhotoSubmission.id == submission_id)
    )).scalar_one_or_none()
    if not ps:
        raise HTTPException(status_code=404, detail="Nicht gefunden")
    if ps.status == "approved":
        raise HTTPException(status_code=400, detail="Bereits freigegeben.")

    if body.approved:
        ps.status = "approved"
        ci = (await db.execute(
            select(CheckIn).where(
                CheckIn.user_id == ps.user_id,
                CheckIn.challenge_id == ps.challenge_id,
                CheckIn.success == True,  # noqa: E712
            )
        )).scalar_one_or_none()
        if ci and ci.points_awarded == 0:
            points = ps.challenge.points
            ci.points_awarded = points
            ps.user.points += points
    else:
        ps.status = "rejected"

    ps.admin_message = body.message
    ps.reviewed_at = datetime.now(UTC)
    await db.commit()
    return {"status": ps.status, "points_awarded": ps.challenge.points if body.approved else 0}
