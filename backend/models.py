import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, JSON, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class PendingMagicLink(Base):
    """
    Temporärer Eintrag für noch nicht verifizierte Magic-Link-Anfragen.
    Nutzer werden erst bei erfolgreicher Verifikation in `users` angelegt.
    Verhindert, dass Spam-Anfragen die users-Tabelle fluten.
    """
    __tablename__ = "pending_magic_links"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String, nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String, nullable=False)
    token: Mapped[str] = mapped_column(String, nullable=False, unique=True, index=True)
    login_code: Mapped[str | None] = mapped_column(String, nullable=True, unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now(), nullable=False)
    consent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    referral_code_used: Mapped[str | None] = mapped_column(String(8), nullable=True)


class UserRole(str, enum.Enum):
    PARTICIPANT = "participant"
    ADMIN = "admin"


class BadgeRuleType(str, enum.Enum):
    CHECKIN_COUNT = "checkin_count"
    STREAK_DAYS = "streak_days"
    CATEGORY = "category"
    ALL_CHALLENGES = "all_challenges"
    SECRET = "secret"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, native_enum=False), default=UserRole.PARTICIPANT, nullable=False
    )
    consent_given: Mapped[bool] = mapped_column(Boolean, default=False)
    is_blocked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    blocked_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    magic_token: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    magic_login_code: Mapped[str | None] = mapped_column(String, nullable=True, unique=True, index=True)
    magic_token_expires: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now(), nullable=False)
    points: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    manual_checkin_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    referral_code: Mapped[str | None] = mapped_column(String(8), unique=True, nullable=True, index=True)
    referred_by_user_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    referral_milestone_paid: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    newsletter_consent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    checkins: Mapped[list["CheckIn"]] = relationship("CheckIn", back_populates="user")
    badges: Mapped[list["UserBadge"]] = relationship("UserBadge", back_populates="user")


class Place(Base):
    __tablename__ = "places"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lon: Mapped[float] = mapped_column(Float, nullable=False)
    radius_m: Mapped[float] = mapped_column(Float, nullable=False, default=75.0)
    category: Mapped[str | None] = mapped_column(String, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String, nullable=True)

    challenges: Mapped[list["Challenge"]] = relationship("Challenge", back_populates="place")


class Challenge(Base):
    __tablename__ = "challenges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    place_id: Mapped[int] = mapped_column(ForeignKey("places.id"), nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    story: Mapped[str | None] = mapped_column(Text, nullable=True)
    day_number: Mapped[int | None] = mapped_column(Integer, nullable=True)  # Tag 1–21
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    points: Mapped[int] = mapped_column(Integer, default=20, nullable=False)
    category: Mapped[str | None] = mapped_column(String, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_mystery: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_task: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_photo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    quiz_question: Mapped[str | None] = mapped_column(Text, nullable=True)
    quiz_options: Mapped[list | None] = mapped_column(JSON, nullable=True)
    quiz_correct_index: Mapped[int | None] = mapped_column(Integer, nullable=True)

    place: Mapped["Place"] = relationship("Place", back_populates="challenges")
    checkins: Mapped[list["CheckIn"]] = relationship("CheckIn", back_populates="challenge")


class CheckIn(Base):
    __tablename__ = "checkins"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    challenge_id: Mapped[int] = mapped_column(ForeignKey("challenges.id"), nullable=False)
    checked_in_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now(), nullable=False)
    success: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    points_awarded: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    distance_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    accuracy_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_flagged: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    flag_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="checkins")
    challenge: Mapped["Challenge"] = relationship("Challenge", back_populates="checkins")


class PhotoSubmission(Base):
    __tablename__ = "photo_submissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    challenge_id: Mapped[int] = mapped_column(ForeignKey("challenges.id"), nullable=False)
    image_base64: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")  # pending|approved|rejected
    admin_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now(), nullable=False)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship("User")
    challenge: Mapped["Challenge"] = relationship("Challenge")

    __table_args__ = (UniqueConstraint("user_id", "challenge_id", name="uq_photo_submission"),)


class AdminAuditLog(Base):
    __tablename__ = "admin_audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    admin_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    target_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String, nullable=False)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now(), nullable=False)


class Badge(Base):
    __tablename__ = "badges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    icon: Mapped[str] = mapped_column(String, nullable=False, default="🏅")
    rule_type: Mapped[BadgeRuleType] = mapped_column(
        Enum(BadgeRuleType, native_enum=False), nullable=False
    )
    rule_value: Mapped[str] = mapped_column(String, nullable=False)

    users: Mapped[list["UserBadge"]] = relationship("UserBadge", back_populates="badge")


class UserBadge(Base):
    __tablename__ = "user_badges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    badge_id: Mapped[int] = mapped_column(ForeignKey("badges.id"), nullable=False)
    awarded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now(), nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="badges")
    badge: Mapped["Badge"] = relationship("Badge", back_populates="users")


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    challenge_id: Mapped[int] = mapped_column(Integer, ForeignKey("challenges.id", ondelete="CASCADE"), primary_key=True)
    wrong_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class Suggestion(Base):
    __tablename__ = "suggestions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)  # "stop" | "sponsor" | "idea" | "support"
    text: Mapped[str] = mapped_column(Text, nullable=False)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lon: Mapped[float | None] = mapped_column(Float, nullable=True)
    image_base64: Mapped[str | None] = mapped_column(Text, nullable=True)
    admin_reply: Mapped[str | None] = mapped_column(Text, nullable=True)
    admin_reply_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now(), nullable=False)

    user: Mapped["User"] = relationship("User")


class SurveyResponse(Base):
    __tablename__ = "survey_responses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, unique=True)
    q1: Mapped[str | None] = mapped_column(String, nullable=True)   # Wo hast du von der App erfahren?
    q2: Mapped[str | None] = mapped_column(String, nullable=True)   # Warum machst du mit?
    q3: Mapped[str | None] = mapped_column(String, nullable=True)   # Teams interessant?
    q4: Mapped[str | None] = mapped_column(String, nullable=True)   # Quize/Aufgaben interessant?
    q5: Mapped[str | None] = mapped_column(Text, nullable=True)     # Freier Wunsch (optional)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now(), nullable=False)
