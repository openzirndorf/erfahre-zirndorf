"""E-Mail-Versand via Scaleway Transactional Email (SMTP).

Umgebungsvariablen:
  SMTP_HOST      – smtp.tem.scaleway.com
  SMTP_PORT      – 465
  SMTP_USER      – Scaleway Project ID
  SMTP_PASSWORD  – Scaleway Secret Key
  SMTP_FROM      – noreply@automail.openzirndorf.de
"""
import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from fastapi import HTTPException, status

from config import settings

logger = logging.getLogger(__name__)


def _smtp_configured() -> bool:
    return bool(settings.smtp_host and settings.smtp_user and settings.smtp_password)


def _send_sync(to: str, subject: str, text: str, html: str) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = settings.smtp_from
    msg["To"]      = to
    msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html",  "utf-8"))

    if settings.smtp_port == 465:
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=15) as s:
            s.login(settings.smtp_user, settings.smtp_password)
            s.sendmail(settings.smtp_from, [to], msg.as_string())
    else:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as s:
            s.starttls()
            s.login(settings.smtp_user, settings.smtp_password)
            s.sendmail(settings.smtp_from, [to], msg.as_string())


async def send_magic_link(to_email: str, token: str, login_code: str) -> None:
    if not _smtp_configured():
        if settings.debug:
            logger.warning("SMTP nicht konfiguriert – Dev-Modus, token=%s, login_code=%s", token, login_code)
            return  # Im Dev-Modus: kein Fehler, token kommt im Response zurück
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="E-Mail-Versand nicht konfiguriert.",
        )

    link = f"{settings.frontend_url}/#/anmelden?token={token}"
    formatted_code = login_code

    text = f"""\
Dein Code für Erfahre Zirndorf:

{formatted_code}

Öffne die App und gib den Code ein.
Der Code ist 15 Minuten gültig.

Falls die E-Mail nicht sofort da war: Bitte schau auch im Spamordner nach.

Falls du gerade im Browser bist, kannst du alternativ diesen Link öffnen:
{link}

Du hast diese E-Mail nicht angefordert? Dann ignoriere sie einfach.

Viele Grüße
Das Erfahre-Zirndorf-Team
"""

    html = f"""
<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1f2937;">
  <h2 style="color:#009a00;margin:0 0 12px;">Erfahre Zirndorf</h2>
  <p style="margin:0 0 16px;">Dein Code:</p>
  <div style="background:#f4f8f4;border:1px solid #d7ead7;border-radius:12px;padding:18px;margin:0 0 18px;text-align:center;">
    <p style="font-family:monospace;font-size:30px;font-weight:bold;letter-spacing:4px;margin:0;color:#111;">
      {formatted_code}
    </p>
  </div>
  <p style="margin:0 0 18px;color:#555;font-size:14px;">
    Öffne die App und gib den Code ein. Er ist <strong>15 Minuten</strong> gültig.
  </p>
  <p style="margin:0 0 18px;color:#92400e;background:#fffbeb;border-radius:10px;padding:12px;font-size:14px;">
    Falls die E-Mail nicht sofort da war: Bitte schau auch im Spamordner nach.
  </p>
  <p style="margin:0 0 18px;">
    <a href="{link}"
       style="display:inline-block;background:#009a00;color:white;padding:13px 22px;
              border-radius:10px;text-decoration:none;font-weight:bold;">
      Stattdessen Link öffnen
    </a>
  </p>
  <p style="color:#777;font-size:13px;line-height:1.5;margin:0;">
    Falls der Button nicht funktioniert:<br>
    <a href="{link}" style="color:#009a00;">{link}</a>
  </p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
  <p style="color:#aaa;font-size:12px;">
    Du hast diese E-Mail nicht angefordert? Dann ignoriere sie einfach.
  </p>
</div>
"""

    try:
        await asyncio.to_thread(
            _send_sync, to_email,
            "Dein Code für Erfahre Zirndorf", text, html
        )
        logger.info("Magic Link gesendet an %s", to_email)
    except Exception as exc:
        logger.error("E-Mail-Versand fehlgeschlagen an %s: %s", to_email, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="E-Mail konnte nicht gesendet werden. Bitte versuche es später erneut.",
        ) from exc
