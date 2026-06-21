from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, field_validator
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_admin_user, get_current_user
from database import get_db
from models import Suggestion, User

limiter = Limiter(key_func=get_remote_address)

_IMAGE_MAX_BYTES = 1 * 1024 * 1024  # 1 MB base64-encoded

router = APIRouter(prefix="/api/suggestions", tags=["suggestions"])

VALID_TYPES = {"stop", "sponsor", "idea", "support"}


class SuggestionCreate(BaseModel):
    type: str
    text: str
    lat: float | None = None
    lon: float | None = None
    image_base64: str | None = None

    @field_validator("image_base64")
    @classmethod
    def limit_image_size(cls, v: str | None) -> str | None:
        if v and len(v.encode()) > _IMAGE_MAX_BYTES:
            raise ValueError("Bild zu groß (max. 1 MB)")
        return v


class SuggestionOut(BaseModel):
    id: int
    type: str
    text: str
    created_at: datetime
    user_display_name: str


class MySuggestionOut(BaseModel):
    id: int
    type: str
    text: str
    created_at: datetime
    admin_reply: str | None
    admin_reply_at: datetime | None


@router.post("", status_code=201)
@limiter.limit("10/hour")
async def create_suggestion(
    request: Request,
    body: SuggestionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.type not in VALID_TYPES:
        raise HTTPException(status_code=400, detail="Ungültiger Typ")
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="Text darf nicht leer sein")
    db.add(Suggestion(
        user_id=current_user.id,
        type=body.type,
        text=body.text.strip(),
        lat=body.lat,
        lon=body.lon,
        image_base64=body.image_base64,
    ))
    await db.commit()
    return {"ok": True}


@router.get("/mine", response_model=list[MySuggestionOut])
async def my_suggestions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Suggestion)
        .where(Suggestion.user_id == current_user.id)
        .order_by(Suggestion.created_at.desc())
        .limit(30)
    )
    return [
        MySuggestionOut(
            id=s.id,
            type=s.type,
            text=s.text,
            created_at=s.created_at,
            admin_reply=s.admin_reply,
            admin_reply_at=s.admin_reply_at,
        )
        for s in result.scalars().all()
    ]


@router.get("/admin", response_model=list[SuggestionOut])
async def list_suggestions(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    result = await db.execute(
        select(Suggestion, User.display_name)
        .join(User, Suggestion.user_id == User.id)
        .order_by(Suggestion.created_at.desc())
    )
    rows = result.all()
    return [
        SuggestionOut(
            id=s.id,
            type=s.type,
            text=s.text,
            created_at=s.created_at,
            user_display_name=name,
        )
        for s, name in rows
    ]


@router.delete("/admin/{suggestion_id}", status_code=204)
async def delete_suggestion(
    suggestion_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    suggestion = await db.get(Suggestion, suggestion_id)
    if not suggestion:
        raise HTTPException(status_code=404, detail="Nicht gefunden")
    await db.delete(suggestion)
    await db.commit()
