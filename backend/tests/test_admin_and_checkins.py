import os
import sys
import tempfile
from pathlib import Path

os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("ADMIN_TOKEN", "test-admin")
os.environ["DEBUG"] = "false"
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{tempfile.mkstemp(prefix='biking-test-', suffix='.db')[1]}"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from datetime import UTC, datetime, timedelta  # noqa: E402

from fastapi.testclient import TestClient  # noqa: E402

from auth import create_jwt  # noqa: E402
from database import AsyncSessionLocal  # noqa: E402
from main import app  # noqa: E402
from models import Challenge, PendingMagicLink, Place, User, UserRole  # noqa: E402


def seed_data():
    import asyncio

    async def _seed():
        async with AsyncSessionLocal() as db:
            suffix = datetime.now(UTC).timestamp()
            admin = User(
                email=f"admin-{suffix}@example.com",
                display_name=f"Admin {suffix}",
                role=UserRole.ADMIN,
                consent_given=True,
            )
            user = User(
                email=f"user-{suffix}@example.com",
                display_name=f"User {suffix}",
                consent_given=True,
            )
            place = Place(title=f"Rathaus {suffix}", lat=49.4439, lon=10.9552, radius_m=100)
            db.add_all([admin, user, place])
            await db.flush()
            challenge = Challenge(
                place_id=place.id,
                title=f"Test {suffix}",
                description="Test",
                start_at=datetime.now(UTC) - timedelta(days=1),
                end_at=datetime.now(UTC) + timedelta(days=1),
                points=20,
            )
            db.add(challenge)
            await db.flush()
            await db.commit()
            return admin.id, user.id, challenge.id, place.lat, place.lon

    return asyncio.run(_seed())


def test_checkin_stores_points_and_admin_reset_recalculates():
    with TestClient(app) as client:
        admin_id, user_id, challenge_id, lat, lon = seed_data()
        user_token = create_jwt(user_id)
        admin_token = create_jwt(admin_id)

        response = client.post(
            "/api/checkins",
            headers={"Authorization": f"Bearer {user_token}"},
            json={
                "challenge_id": challenge_id,
                "position": {"lat": lat, "lon": lon, "accuracy_m": 5},
                "client_ts": datetime.now(UTC).isoformat(),
            },
        )
        assert response.status_code == 200
        assert response.json()["success"] is True
        assert response.json()["points_awarded"] == 30

        reset = client.post(
            f"/api/admin/users/{user_id}/reset-checkins",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"challenge_id": challenge_id},
        )
        assert reset.status_code == 200
        assert reset.json()["deleted_checkins"] == 1
        assert reset.json()["points"] == 0


def test_blocked_user_gets_block_message():
    with TestClient(app) as client:
        admin_id, user_id, *_ = seed_data()
        admin_token = create_jwt(admin_id)
        user_token = create_jwt(user_id)

        block = client.patch(
            f"/api/admin/users/{user_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"is_blocked": True, "blocked_reason": "Du bist testweise gesperrt."},
        )
        assert block.status_code == 200

        progress = client.get(
            "/api/users/me/progress",
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert progress.status_code == 403
        assert progress.json()["detail"] == "Dein Account wurde gesperrt. Du bist testweise gesperrt."


def test_admin_cannot_demote_self():
    with TestClient(app) as client:
        admin_id, *_ = seed_data()
        admin_token = create_jwt(admin_id)

        response = client.patch(
            f"/api/admin/users/{admin_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"role": "participant"},
        )
        assert response.status_code == 422
        assert "Admin-Rolle" in response.json()["detail"]


def test_registration_requires_fair_play_for_new_accounts():
    with TestClient(app) as client:
        suffix = datetime.now(UTC).timestamp()
        response = client.post(
            "/api/auth/request-magic-link",
            json={
                "email": f"fairplay-{suffix}@example.com",
                "display_name": f"Fairplay {suffix}",
                "consent": True,
                "fair_play": False,
            },
        )
        assert response.status_code == 422
        assert "Fair-Play" in response.json()["detail"]


def test_existing_user_can_verify_with_login_code():
    import asyncio

    with TestClient(app) as client:
        _, user_id, *_ = seed_data()

        async def _add_code():
            async with AsyncSessionLocal() as db:
                user = await db.get(User, user_id)
                user.magic_token = "token-for-existing-user"
                user.magic_login_code = "ABCD1234"
                user.magic_token_expires = datetime.now(UTC) + timedelta(minutes=15)
                await db.commit()

        asyncio.run(_add_code())

        response = client.post("/api/auth/verify", json={"token": "ABCD-1234"})
        assert response.status_code == 200
        assert response.json()["user_id"] == user_id


def test_pending_registration_can_verify_with_login_code():
    import asyncio

    with TestClient(app) as client:
        suffix = datetime.now(UTC).timestamp()

        async def _add_pending():
            async with AsyncSessionLocal() as db:
                db.add(PendingMagicLink(
                    email=f"code-{suffix}@example.com",
                    display_name=f"Code User {suffix}",
                    token=f"pending-token-{suffix}",
                    login_code="WXYZ7892",
                    expires_at=datetime.now(UTC) + timedelta(minutes=15),
                    consent=True,
                ))
                await db.commit()

        asyncio.run(_add_pending())

        response = client.post("/api/auth/verify", json={"token": "WXYZ-7892"})
        assert response.status_code == 200
        assert response.json()["display_name"] == f"Code User {suffix}"


def test_flagged_checkin_can_be_reviewed_and_is_audited():
    with TestClient(app) as client:
        admin_id, user_id, challenge_id, lat, lon = seed_data()
        user_token = create_jwt(user_id)
        admin_token = create_jwt(admin_id)

        response = client.post(
            "/api/checkins",
            headers={"Authorization": f"Bearer {user_token}"},
            json={
                "challenge_id": challenge_id,
                "position": {"lat": lat, "lon": lon, "accuracy_m": 200},
                "client_ts": datetime.now(UTC).isoformat(),
            },
        )
        assert response.status_code == 200
        assert response.json()["success"] is False
        assert response.json()["is_flagged"] is True

        flagged = client.get(
            "/api/admin/checkins/flagged",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert flagged.status_code == 200
        checkin_id = flagged.json()[0]["id"]

        review = client.patch(
            f"/api/admin/checkins/{checkin_id}/review",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"is_flagged": False, "flag_reason": None},
        )
        assert review.status_code == 200
        assert review.json()["is_flagged"] is False

        audit = client.get(
            "/api/admin/audit-log",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert audit.status_code == 200
        assert any(entry["action"] == "checkin_review" for entry in audit.json())


def test_admin_user_detail_and_health_status():
    with TestClient(app) as client:
        admin_id, user_id, challenge_id, lat, lon = seed_data()
        user_token = create_jwt(user_id)
        admin_token = create_jwt(admin_id)

        checkin = client.post(
            "/api/checkins",
            headers={"Authorization": f"Bearer {user_token}"},
            json={
                "challenge_id": challenge_id,
                "position": {"lat": lat, "lon": lon, "accuracy_m": 5},
                "client_ts": datetime.now(UTC).isoformat(),
            },
        )
        assert checkin.status_code == 200

        detail = client.get(
            f"/api/admin/users/{user_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert detail.status_code == 200
        assert detail.json()["user"]["id"] == user_id
        assert detail.json()["checkins"][0]["challenge_id"] == challenge_id

        health = client.get(
            "/api/admin/health-status",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert health.status_code == 200
        assert health.json()["api"] == "ok"
        assert health.json()["database"] == "ok"
        assert health.json()["users"] >= 2
