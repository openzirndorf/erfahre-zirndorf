from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import AsyncConnection


async def run_schema_migrations(conn: AsyncConnection) -> None:
    """Small idempotent migrations for deployments without Alembic."""

    def existing_columns(sync_conn, table_name: str) -> set[str]:
        inspector = inspect(sync_conn)
        return {c["name"] for c in inspector.get_columns(table_name)}

    def get_dialect_name(sync_conn) -> str:
        return sync_conn.dialect.name

    is_postgres = (await conn.run_sync(get_dialect_name)) == "postgresql"
    user_columns = await conn.run_sync(existing_columns, "users")
    if "manual_checkin_count" not in user_columns:
        await conn.execute(text("ALTER TABLE users ADD COLUMN manual_checkin_count INTEGER NOT NULL DEFAULT 0"))
    if "is_blocked" not in user_columns:
        await conn.execute(text("ALTER TABLE users ADD COLUMN is_blocked BOOLEAN NOT NULL DEFAULT false"))
    if "blocked_reason" not in user_columns:
        await conn.execute(text("ALTER TABLE users ADD COLUMN blocked_reason TEXT"))
    if "magic_login_code" not in user_columns:
        await conn.execute(text("ALTER TABLE users ADD COLUMN magic_login_code VARCHAR"))
        await conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_magic_login_code ON users (magic_login_code)"))

    if "referral_code" not in user_columns:
        await conn.execute(text("ALTER TABLE users ADD COLUMN referral_code VARCHAR(8)"))
        if is_postgres:
            await conn.execute(text("UPDATE users SET referral_code = upper(left(md5(id::text || 'ref26'), 7)) WHERE referral_code IS NULL"))
        else:
            await conn.execute(text("UPDATE users SET referral_code = upper(hex(randomblob(4))) WHERE referral_code IS NULL"))
        await conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_referral_code ON users (referral_code) WHERE referral_code IS NOT NULL"))
    if "referred_by_user_id" not in user_columns:
        await conn.execute(text("ALTER TABLE users ADD COLUMN referred_by_user_id INTEGER REFERENCES users(id)"))
    if "referral_milestone_paid" not in user_columns:
        await conn.execute(text("ALTER TABLE users ADD COLUMN referral_milestone_paid BOOLEAN NOT NULL DEFAULT false"))
    if "newsletter_consent" not in user_columns:
        await conn.execute(text("ALTER TABLE users ADD COLUMN newsletter_consent BOOLEAN NOT NULL DEFAULT false"))

    pending_columns = await conn.run_sync(existing_columns, "pending_magic_links")
    if "login_code" not in pending_columns:
        await conn.execute(text("ALTER TABLE pending_magic_links ADD COLUMN login_code VARCHAR"))
        await conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_pending_magic_links_login_code ON pending_magic_links (login_code)"))
    if "referral_code_used" not in pending_columns:
        await conn.execute(text("ALTER TABLE pending_magic_links ADD COLUMN referral_code_used VARCHAR(8)"))

    challenge_columns = await conn.run_sync(existing_columns, "challenges")
    if "is_mystery" not in challenge_columns:
        await conn.execute(text("ALTER TABLE challenges ADD COLUMN is_mystery BOOLEAN NOT NULL DEFAULT false"))
    if "is_task" not in challenge_columns:
        await conn.execute(text("ALTER TABLE challenges ADD COLUMN is_task BOOLEAN NOT NULL DEFAULT false"))
    if "is_photo" not in challenge_columns:
        await conn.execute(text("ALTER TABLE challenges ADD COLUMN is_photo BOOLEAN NOT NULL DEFAULT false"))
    if "quiz_question" not in challenge_columns:
        await conn.execute(text("ALTER TABLE challenges ADD COLUMN quiz_question TEXT"))
    if "quiz_options" not in challenge_columns:
        await conn.execute(text("ALTER TABLE challenges ADD COLUMN quiz_options JSONB"))
    if "quiz_correct_index" not in challenge_columns:
        await conn.execute(text("ALTER TABLE challenges ADD COLUMN quiz_correct_index INTEGER"))

    checkin_columns = await conn.run_sync(existing_columns, "checkins")
    if "is_flagged" not in checkin_columns:
        await conn.execute(text("ALTER TABLE checkins ADD COLUMN is_flagged BOOLEAN NOT NULL DEFAULT false"))
    if "points_awarded" not in checkin_columns:
        await conn.execute(text("ALTER TABLE checkins ADD COLUMN points_awarded INTEGER NOT NULL DEFAULT 0"))
        await conn.execute(
            text(
                """
                UPDATE checkins
                SET points_awarded = (
                    SELECT challenges.points
                    FROM challenges
                    WHERE challenges.id = checkins.challenge_id
                )
                WHERE success = true
                """
            )
        )
    if "flag_reason" not in checkin_columns:
        await conn.execute(text("ALTER TABLE checkins ADD COLUMN flag_reason TEXT"))

    # Umfrage
    if is_postgres:
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS survey_responses (
                id SERIAL PRIMARY KEY,
                user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
                q1 VARCHAR,
                q2 VARCHAR,
                q3 VARCHAR,
                q4 VARCHAR,
                q5 TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """))
    else:
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS survey_responses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
                q1 VARCHAR,
                q2 VARCHAR,
                q3 VARCHAR,
                q4 VARCHAR,
                q5 TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
    survey_columns = await conn.run_sync(existing_columns, "survey_responses")
    if "q4" not in survey_columns:
        await conn.execute(text("ALTER TABLE survey_responses ADD COLUMN q4 VARCHAR"))
    if "q5" not in survey_columns:
        await conn.execute(text("ALTER TABLE survey_responses ADD COLUMN q5 TEXT"))
    if "rating" not in survey_columns:
        await conn.execute(text("ALTER TABLE survey_responses ADD COLUMN rating INTEGER"))
    if "rating_comment" not in survey_columns:
        await conn.execute(text("ALTER TABLE survey_responses ADD COLUMN rating_comment TEXT"))

    # Gewinne
    if is_postgres:
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS prizes (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR NOT NULL,
                description TEXT,
                sponsor VARCHAR,
                awarded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                user_claimed_at TIMESTAMP WITH TIME ZONE,
                admin_confirmed_at TIMESTAMP WITH TIME ZONE,
                notes TEXT
            )
        """))
    else:
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS prizes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR NOT NULL,
                description TEXT,
                sponsor VARCHAR,
                awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                user_claimed_at TIMESTAMP,
                admin_confirmed_at TIMESTAMP,
                notes TEXT
            )
        """))

    # Quiz-Fehlversuche
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS quiz_attempts (
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
            wrong_count INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (user_id, challenge_id)
        )
    """))

    # Vorschläge
    if is_postgres:
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS suggestions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                type VARCHAR NOT NULL,
                text TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """))
    else:
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS suggestions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                type VARCHAR NOT NULL,
                text TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
    suggestion_columns = await conn.run_sync(existing_columns, "suggestions")
    if "lat" not in suggestion_columns:
        await conn.execute(text("ALTER TABLE suggestions ADD COLUMN lat FLOAT"))
    if "lon" not in suggestion_columns:
        await conn.execute(text("ALTER TABLE suggestions ADD COLUMN lon FLOAT"))
    if "image_base64" not in suggestion_columns:
        await conn.execute(text("ALTER TABLE suggestions ADD COLUMN image_base64 TEXT"))
    if "admin_reply" not in suggestion_columns:
        await conn.execute(text("ALTER TABLE suggestions ADD COLUMN admin_reply TEXT"))
    if "admin_reply_at" not in suggestion_columns:
        await conn.execute(text("ALTER TABLE suggestions ADD COLUMN admin_reply_at TIMESTAMP WITH TIME ZONE"))

    # Performance-Indizes
    await conn.execute(text(
        "CREATE INDEX IF NOT EXISTS ix_checkins_user_success ON checkins (user_id, success)"
    ))
    await conn.execute(text(
        "CREATE INDEX IF NOT EXISTS ix_checkins_challenge_success ON checkins (challenge_id, success)"
    ))
    await conn.execute(text(
        "CREATE INDEX IF NOT EXISTS ix_checkins_checked_in_at ON checkins (checked_in_at)"
    ))
    await conn.execute(text(
        "CREATE INDEX IF NOT EXISTS ix_challenges_active_start ON challenges (is_active, start_at)"
    ))
