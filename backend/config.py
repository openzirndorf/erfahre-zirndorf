from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///./biking.db"
    secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_expire_hours: int = 168  # 7 Tage – kürzere Session für ein Event
    admin_token: str
    cors_origins: str = "http://localhost:5173,http://localhost:4173"
    frontend_url: str = "http://localhost:5173"

    # Checkin-Parameter
    max_accuracy_m: float = 50.0
    default_radius_m: float = 75.0
    bonus_first_checkin: int = 5
    bonus_first_day: int = 5

    # Aktionszeitraum
    event_start: str = "2026-06-06"
    event_end: str = "2026-07-12"

    # Altcha Proof-of-Work (Anti-Spam, kein Tracking)
    altcha_hmac_key: str = ""  # leer = Altcha deaktiviert (nur lokal akzeptabel)
    altcha_max_number: int = 100_000  # höher = mehr Rechenaufwand für den Client

    # Altcha deaktivieren ohne HMAC-Key zu ändern (z.B. bei Widget-Problemen)
    altcha_disabled: bool = False

    # E-Mail via Scaleway Transactional Email (SMTP)
    smtp_host: str = ""
    smtp_port: int = 465
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "noreply@automail.openzirndorf.de"

    # Sicherheit
    debug: bool = False                  # True → dev_token im Response sichtbar
    magic_link_ttl_minutes: int = 15
    magic_link_cooldown_seconds: int = 60  # Wartezeit zwischen zwei Link-Anfragen pro Mail
    first_admin_email: str = ""          # Diese E-Mail bekommt beim ersten Login automatisch Admin-Rolle

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"


settings = Settings()
