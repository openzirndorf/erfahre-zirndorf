import secrets
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, StringConstraints
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import blocked_detail, create_jwt
from config import settings
from database import get_db
from email_service import send_magic_link
from models import PendingMagicLink, User, UserRole

limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/api/auth", tags=["auth"])

DisplayName = Annotated[str, StringConstraints(min_length=2, max_length=50, strip_whitespace=True)]

_GENERIC_SENT = {"message": "Magic Link wurde gesendet"}
_LOGIN_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"


def _normalize_login_code(value: str) -> str:
    return "".join(ch for ch in value.upper() if ch.isalnum())


async def _generate_login_code(db: AsyncSession) -> str:
    for _ in range(10):
        code = "".join(secrets.choice(_LOGIN_CODE_ALPHABET) for _ in range(8))
        existing_user = (await db.execute(
            select(User).where(User.magic_login_code == code)
        )).scalar_one_or_none()
        existing_pending = (await db.execute(
            select(PendingMagicLink).where(PendingMagicLink.login_code == code)
        )).scalar_one_or_none()
        if not existing_user and not existing_pending:
            return code
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Anmeldecode konnte nicht erzeugt werden. Bitte versuche es erneut.",
    )




class MagicLinkRequest(BaseModel):
    email: EmailStr
    display_name: DisplayName | None = None  # nur für Erstregistrierung erforderlich
    consent: bool = False
    fair_play: bool = False


class VerifyRequest(BaseModel):
    token: str


class AuthResponse(BaseModel):
    token: str
    user_id: int
    display_name: str
    role: str


async def _cleanup_expired(db: AsyncSession) -> None:
    """Veraltete Einträge löschen – läuft bei jeder Anfrage mit, kostet kaum etwas."""
    await db.execute(
        delete(PendingMagicLink).where(PendingMagicLink.expires_at < datetime.now(UTC))
    )


@router.post("/request-magic-link", status_code=202)
@limiter.limit("100/5minute" if settings.debug else "5/3minute")
async def request_magic_link(
    request: Request,
    body: MagicLinkRequest,
    db: AsyncSession = Depends(get_db),
):
    if not body.consent:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Datenschutz-Einwilligung erforderlich",
        )

    await _cleanup_expired(db)

    own_user = (await db.execute(select(User).where(User.email == body.email))).scalar_one_or_none()
    if not own_user and not body.display_name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Bitte einen Anzeigenamen angeben.",
        )
    if not own_user and not body.fair_play:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Fair-Play-Bestätigung erforderlich. GPS-Spoofing und manipulierte Standorte sind nicht erlaubt.",
        )

    # ── Display-Name-Eindeutigkeit prüfen ────────────────────────────────
    name_user = (await db.execute(
        select(User).where(User.display_name == body.display_name)
    )).scalar_one_or_none()
    name_pending = (await db.execute(
        select(PendingMagicLink).where(PendingMagicLink.display_name == body.display_name)
    )).scalar_one_or_none()
    # Erlaubt: bestehender User mit gleichem Namen AKTUALISIERT seinen eigenen Link
    if name_user and name_user != own_user:
        raise HTTPException(status_code=422, detail="Dieser Anzeigename ist bereits vergeben.")
    if name_pending and name_pending.email != body.email:
        raise HTTPException(status_code=422, detail="Dieser Anzeigename ist bereits vergeben.")

    # ── Cooldown pro E-Mail ──────────────────────────────────────────────
    # Prüft sowohl verifizierte User als auch noch offene Pending-Einträge.
    pending_result = await db.execute(
        select(PendingMagicLink).where(PendingMagicLink.email == body.email)
    )
    existing_pending = pending_result.scalar_one_or_none()

    if existing_pending:
        requested_at = existing_pending.expires_at - timedelta(minutes=settings.magic_link_ttl_minutes)
        requested_at = requested_at.replace(tzinfo=UTC)
        cooldown_until = requested_at + timedelta(seconds=settings.magic_link_cooldown_seconds)
        if datetime.now(UTC) < cooldown_until:
            wait = int((cooldown_until - datetime.now(UTC)).total_seconds())
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Bitte {wait} Sekunden warten.",
            )
        # Alten Eintrag ersetzen
        await db.delete(existing_pending)

    # Auch für bereits verifizierte User Cooldown prüfen
    existing_user = own_user
    if existing_user and existing_user.magic_token_expires:
        expires_aware = existing_user.magic_token_expires.replace(tzinfo=UTC)
        requested_at = expires_aware - timedelta(minutes=settings.magic_link_ttl_minutes)
        cooldown_until = requested_at + timedelta(seconds=settings.magic_link_cooldown_seconds)
        if datetime.now(UTC) < cooldown_until:
            wait = int((cooldown_until - datetime.now(UTC)).total_seconds())
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Bitte {wait} Sekunden warten.",
            )

    token = secrets.token_urlsafe(32)
    login_code = await _generate_login_code(db)
    expires = datetime.now(UTC) + timedelta(minutes=settings.magic_link_ttl_minutes)

    if existing_user:
        # Bereits registrierter User: Token direkt auf dem User speichern
        existing_user.magic_token = token
        existing_user.magic_login_code = login_code
        existing_user.magic_token_expires = expires
        if body.display_name:
            existing_user.display_name = body.display_name
    else:
        # Neuer User: nur Pending-Eintrag, KEIN User-Datensatz
        db.add(PendingMagicLink(
            email=body.email,
            display_name=body.display_name,
            token=token,
            login_code=login_code,
            expires_at=expires,
            consent=body.consent,
        ))

    await send_magic_link(body.email, token, login_code)

    payload = dict(_GENERIC_SENT)
    if settings.debug:
        payload["dev_token"] = token
        payload["dev_code"] = login_code

    return payload


@router.post("/verify", response_model=AuthResponse)
@limiter.limit("20/minute")
async def verify_magic_link(
    request: Request,
    body: VerifyRequest,
    db: AsyncSession = Depends(get_db),
):
    invalid_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Ungültiger oder abgelaufener Link",
    )

    now = datetime.now(UTC)

    credential = body.token.strip()
    login_code = _normalize_login_code(credential)

    # ── Bereits verifizierter User? ──────────────────────────────────────
    user_result = await db.execute(select(User).where(User.magic_token == credential))
    user = user_result.scalar_one_or_none()
    if not user and login_code:
        user_result = await db.execute(select(User).where(User.magic_login_code == login_code))
        user = user_result.scalar_one_or_none()

    if user:
        if user.is_blocked:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=blocked_detail(user),
            )
        expires = user.magic_token_expires
        if expires is not None:
            if expires.tzinfo is None:
                expires = expires.replace(tzinfo=UTC)
            if expires < now:
                user.magic_token = None
                user.magic_login_code = None
                user.magic_token_expires = None
                raise invalid_exc
        user.magic_token = None
        user.magic_login_code = None
        user.magic_token_expires = None

    else:
        # ── Pending-Eintrag (Erstregistrierung) ──────────────────────────
        pending_result = await db.execute(
            select(PendingMagicLink).where(PendingMagicLink.token == credential)
        )
        pending = pending_result.scalar_one_or_none()
        if not pending and login_code:
            pending_result = await db.execute(
                select(PendingMagicLink).where(PendingMagicLink.login_code == login_code)
            )
            pending = pending_result.scalar_one_or_none()

        if not pending:
            raise invalid_exc

        expires = pending.expires_at.replace(tzinfo=UTC)
        if expires < now:
            await db.delete(pending)
            raise invalid_exc

        # Jetzt erst den User anlegen
        user = User(
            email=pending.email,
            display_name=pending.display_name,
            consent_given=pending.consent,
        )
        db.add(user)
        await db.delete(pending)
        await db.flush()

    # ── Auto-Admin ───────────────────────────────────────────────────────
    if (
        settings.first_admin_email
        and user.email == settings.first_admin_email
        and user.role != UserRole.ADMIN
    ):
        user.role = UserRole.ADMIN

    return AuthResponse(
        token=create_jwt(user.id),
        user_id=user.id,
        display_name=user.display_name,
        role=user.role,
    )
