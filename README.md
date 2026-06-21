# Erfahre Zirndorf

Stadtradeln-Begleit-App für Zirndorf: GPS-Check-ins an Orten, Teams, Rangliste, Magic-Link-Auth.

Live: `https://erfahre.openzirndorf.de`  
API-Docs: `https://erfahre.openzirndorf.de/api/docs`

---

## Architektur

```
Browser
  └── https://erfahre.openzirndorf.de
        └── Scaleway Serverless Container (FastAPI + React, ein Docker-Image)
              └── Scaleway Managed RDB (PostgreSQL 16, db-dev-s, ~3 €/Monat)
```

Frontend und Backend laufen im **selben Container** — React-Build wird beim Docker-Build
eingebaut und von FastAPI als statische Dateien ausgeliefert. Kein separates Hosting.

```
erfahre/
├── backend/               FastAPI-Backend
│   ├── main.py            App-Factory, Logging, CORS, Rate-Limiting (slowapi)
│   ├── config.py          Pydantic-Settings (alle Env-Variablen typisiert)
│   ├── models.py          SQLAlchemy-ORM-Modelle
│   ├── database.py        Async SQLAlchemy Engine + Session
│   ├── migrations.py      Idempotente Schema-Migrationen (laufen beim Start)
│   ├── auth.py            JWT-Erstellung + Verifikation
│   ├── altcha.py          Proof-of-Work Spam-Schutz (GDPR-konform, kein Tracking)
│   ├── email_service.py   Magic-Link-Mails via Scaleway TEM
│   ├── checkin_logic.py   GPS-Radius-Prüfung, Punkte, Bonus-Logik
│   ├── seed.py            Orte/Challenges aus challenges.json laden (CI + lokal)
│   ├── challenges.json    Orte & Aufgaben (gitignored, kommt aus erfahre-assets)
│   ├── rdb-ca.pem         TLS-CA-Zertifikat für Scaleway RDB
│   └── routers/
│       ├── auth.py        Magic-Link-Anforderung + Einlösung
│       ├── users.py       Profil, Anzeigename, Account löschen
│       ├── checkins.py    GPS-Check-in einreichen
│       ├── challenges.py  Orte und Aufgaben abrufen
│       ├── teams.py       Teams erstellen, beitreten, verlassen
│       ├── survey.py      Optionale Abschlussumfrage
│       ├── suggestions.py Orts-Vorschläge von Nutzern
│       └── admin.py       Admin-Endpunkte (Nutzer sperren, Daten einsehen)
├── frontend/              React-SPA
│   └── src/
│       ├── pages/         Routing-Ebene (home, map, login, profile, ranking …)
│       ├── components/    Wiederverwendbare UI
│       ├── api/           Zentraler API-Client
│       └── lib/           Utilities
├── infra/                 OpenTofu (Scaleway)
│   ├── main.tf            RDB, Registry, Container, Custom Domain + S3-Backend
│   ├── variables.tf       Eingabevariablen
│   ├── outputs.tf         Ausgabewerte
│   ├── terraform.tfvars          Secrets (gitignored)
│   ├── terraform.tfvars.example  Vorlage
│   └── backend.hcl               State-Credentials (gitignored)
└── .github/workflows/
    └── deploy.yml         Build + Seed + Deploy + Verify (ein Workflow für alles)
```

**Ablauf einer Nutzer-Session:**
1. Nutzer gibt E-Mail ein → Magic Link wird per Mail verschickt
2. Nutzer klickt Link → JWT wird ausgestellt (7 Tage gültig)
3. Nutzer checkt per GPS an einem Ort ein → Punkte + Challenges werden geprüft
4. Punkte fließen ins Team-Ranking ein
5. Am Ende: optionale Abschlussumfrage

**Aktionszeitraum** (`event_start` / `event_end` in `terraform.tfvars`):
Check-ins außerhalb des Zeitraums werden abgelehnt. Kann ohne Redeploy via `tofu apply` geändert werden.

---

## Credentials

Das Projekt hat sieben Credential-Gruppen:

### 1. Scaleway Haupt-API-Key
**Zweck:** OpenTofu verwaltet damit alle Scaleway-Ressourcen (RDB, Container, Registry …)

| Wo | Variable |
|----|----------|
| `infra/terraform.tfvars` | `scw_access_key`, `scw_secret_key`, `scw_project_id` |
| GitHub Actions Secrets | `SCW_ACCESS_KEY`, `SCW_SECRET_KEY` |

`SCW_SECRET_KEY` ist gleichzeitig das SMTP-Passwort (Gruppe 7).

**Rotieren:**
1. Scaleway Console → IAM → API Keys → neuen Key anlegen
2. `terraform.tfvars` aktualisieren (`scw_access_key`, `scw_secret_key`)
3. `terraform.tfvars` aktualisieren (`smtp_password` = neuer `scw_secret_key`)
4. GitHub Secrets `SCW_ACCESS_KEY` + `SCW_SECRET_KEY` aktualisieren
5. `tofu apply`
6. Alten Key löschen

---

### 2. Terraform-State-Key
**Zweck:** Lese-/Schreibzugriff auf den OpenTofu-State im S3-Bucket `openzirndorf-tfstate`

| Wo | Variable |
|----|----------|
| `infra/backend.hcl` | `access_key`, `secret_key` |
| GitHub Actions Secrets | `TF_STATE_ACCESS_KEY`, `TF_STATE_SECRET_KEY` |

IAM-Application: `terraform-state` mit `ObjectStorageFullAccess` (geteilt mit garagenflohmarkt,
State liegt unter `erfahre/terraform.tfstate` im Bucket).

**Rotieren:**
1. Scaleway Console → IAM → neuen Key für Application `terraform-state`
2. `infra/backend.hcl` aktualisieren
3. GitHub Secrets aktualisieren
4. `tofu init -backend-config=backend.hcl`
5. Alten Key löschen

---

### 3. Datenbank-Passwort
**Zweck:** Verbindung zum Scaleway Managed RDB (PostgreSQL-User `erfahre`)

| Wo | Variable |
|----|----------|
| `infra/terraform.tfvars` | `db_password` |
| Container-Env | Teil der `DATABASE_URL` (secret, von OpenTofu gesetzt) |
| GitHub Actions Secret | `DATABASE_URL` (für Datenbank-Seed im CI) |

Anders als im Garagenflohmarkt ist dies ein **explizites Passwort** für einen dedizierten
PostgreSQL-User — kein IAM-Key-basiertes Auth.

**Rotieren:**
```bash
openssl rand -hex 16   # neues Passwort
```
1. `terraform.tfvars` → `db_password` aktualisieren
2. `tofu apply` (ändert DB-User-Passwort + `DATABASE_URL` im Container)
3. GitHub Secret `DATABASE_URL` aktualisieren:
   ```bash
   cd infra && tofu output -raw database_connection_string
   ```

---

### 4. JWT Secret Key
**Zweck:** Signierung und Verifikation von JWT-Tokens (7 Tage gültig)

| Wo | Variable |
|----|----------|
| `infra/terraform.tfvars` | `secret_key` |
| Container-Env | `SECRET_KEY` (secret, von OpenTofu) |
| GitHub Actions Secret | `APP_SECRET_KEY` (für Seed-Step im CI) |

**Rotieren:** Alle bestehenden Logins werden ungültig — Nutzer müssen sich neu anmelden.
```bash
openssl rand -hex 32
```
1. `terraform.tfvars` aktualisieren → `tofu apply`
2. GitHub Secret `APP_SECRET_KEY` aktualisieren

---

### 5. Admin-Token
**Zweck:** Authentifizierung für Admin-API-Endpunkte (`/api/admin/…`)

| Wo | Variable |
|----|----------|
| `infra/terraform.tfvars` | `admin_token` |
| Container-Env | `ADMIN_TOKEN` (secret, von OpenTofu) |
| GitHub Actions Secret | `APP_ADMIN_TOKEN` (für Seed-Step im CI) |

**Rotieren:**
```bash
openssl rand -hex 24
```
1. `terraform.tfvars` aktualisieren → `tofu apply`
2. GitHub Secret `APP_ADMIN_TOKEN` aktualisieren

---

### 6. Altcha HMAC Key
**Zweck:** Proof-of-Work Spam-Schutz bei Registrierung (GDPR-konform, kein Tracking)

| Wo | Variable |
|----|----------|
| `infra/terraform.tfvars` | `altcha_hmac_key` |
| Container-Env | `ALTCHA_HMAC_KEY` (secret, von OpenTofu) |

Kann mit `ALTCHA_DISABLED=true` in `terraform.tfvars` deaktiviert werden (z.B. bei Widget-Problemen).

**Rotieren:**
```bash
openssl rand -hex 32
```
→ `terraform.tfvars` aktualisieren → `tofu apply`

---

### 7. SMTP / Transactional Email
**Zweck:** Magic-Link-Mails via Scaleway TEM

| Einstellung | Wert | Herkunft |
|-------------|------|----------|
| `SMTP_HOST` | `smtp.tem.scaleway.com` | hardcoded in `main.tf` |
| `SMTP_PORT` | `465` (SSL) | hardcoded in `main.tf` |
| `SMTP_USER` | Project ID | `terraform.tfvars` → `smtp_user` |
| `SMTP_PASSWORD` | Secret Key | `terraform.tfvars` → `smtp_password` |
| `SMTP_FROM` | `noreply@automail.openzirndorf.de` | `terraform.tfvars` → `smtp_from` |

`smtp_password` = `scw_secret_key` aus Gruppe 1 — rotiert damit mit.
Absenderdomain muss in Scaleway Console → Transactional Email verifiziert sein (SPF + DKIM).

---

### Assets-Token (GitHub)
**Zweck:** CI-Zugriff auf das private Repo `openzirndorf/erfahre-assets` (Bilder, challenges.json)

| Wo | Variable |
|----|----------|
| GitHub Actions Secret | `ASSETS_TOKEN` |

GitHub PAT (classic) mit `repo`-Scope auf den `openzirndorf`-Account.  
Erneuern unter: GitHub → Settings → Developer settings → Personal access tokens

---

## GitHub Actions Secrets — Übersicht

| Secret | Woher | Zweck |
|--------|-------|-------|
| `SCW_ACCESS_KEY` | Gruppe 1 | Docker Registry Login + Scaleway API |
| `SCW_SECRET_KEY` | Gruppe 1 | Docker Registry Login + SMTP |
| `SCW_REGISTRY_ENDPOINT` | `tofu output -raw registry_endpoint` | Docker Image-Ziel |
| `SCW_CONTAINER_ID` | `tofu output -raw container_id` | Deploy-Target |
| `TF_STATE_ACCESS_KEY` | Gruppe 2 | OpenTofu State lesen/schreiben |
| `TF_STATE_SECRET_KEY` | Gruppe 2 | OpenTofu State lesen/schreiben |
| `ASSETS_TOKEN` | GitHub PAT | erfahre-assets auschecken |
| `APP_SECRET_KEY` | Gruppe 4 | Datenbank-Seed im CI |
| `APP_ADMIN_TOKEN` | Gruppe 5 | Datenbank-Seed im CI |
| `DATABASE_URL` | `tofu output -raw database_connection_string` | Datenbank-Seed im CI |

---

## Lokale Entwicklung

### Voraussetzungen

```bash
# OpenTofu
curl --proto '=https' --tlsv1.2 -fsSL https://get.opentofu.org/install-opentofu.sh | sh -s -- --install-method deb

# Python 3.12
sudo apt install python3.12-venv

# Node.js 22
curl -fsSL https://fnm.vercel.app/install | bash && fnm install 22

# PostgreSQL-Client
sudo apt install postgresql-client

# pre-commit
pip install pre-commit && pre-commit install
```

### Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Lokale Konfiguration — SQLite als Fallback, kein Scaleway nötig
cat > .env << 'EOF'
DATABASE_URL=sqlite+aiosqlite:///./biking.db
SECRET_KEY=lokaler-jwt-key-min-32-zeichen-lang
ADMIN_TOKEN=lokaler-admintoken
EOF

# Challenges einkopieren (oder Beispieldatei verwenden)
cp challenges.json.example challenges.json

# Datenbank initialisieren + Orte laden
python3 seed.py --sync

# Server starten
uvicorn main:app --reload --port 8080
# → http://localhost:8080/api/health  →  {"status":"ok","version":"dev"}
# → http://localhost:8080/api/docs    →  Swagger UI
```

Gegen die Scaleway-Datenbank entwickeln:
```bash
cd infra
tofu output -raw database_connection_string
# → postgresql+asyncpg://erfahre:PASS@HOST:PORT/erfahre
```

### Frontend

```bash
cd frontend
npm install

cat > .env.local << 'EOF'
VITE_API_URL=http://localhost:8080
EOF

npm run dev
# → http://localhost:5173/
```

---

## Infrastruktur-Änderungen (OpenTofu)

```bash
cd infra

# Beim ersten Checkout: backend.hcl anlegen (Werte aus GitHub Secrets TF_STATE_*)
cat > backend.hcl << 'EOF'
access_key = "..."
secret_key = "..."
EOF

tofu init -backend-config=backend.hcl
tofu plan
tofu apply
```

**Achtung RDB:** Die Managed-RDB-Instanz braucht ~5 Min zum Starten bei `tofu apply`.
Ein `destroy` löscht alle Daten unwiderruflich.

### Aktionszeitraum anpassen (ohne Redeploy)
```bash
# terraform.tfvars:
event_start = "2026-06-06"
event_end   = "2026-07-05"

tofu apply
# → nur Container-Env wird aktualisiert, kein Image-Build nötig
```

---

## Deployment

Der einzige Workflow `deploy.yml` läuft bei jedem Push auf `main` und macht alles:

1. **Assets auschecken** aus `openzirndorf/erfahre-assets` (Bilder, challenges.json)
2. **Docker Image bauen** mit Git-SHA als Tag (`APP_VERSION` build-arg)
3. **Image pushen** (3 Versuche mit Timeout, Scaleway Registry hängt manchmal)
4. **Datenbank seeden** — `seed.py --sync` aktualisiert Orte/Challenges ohne Datenverlust
5. **Container deployen** via Scaleway API (PATCH → setzt neues Image-Tag)
6. **Live-Version verifizieren** — pollt `/api/health` bis `"version":"<sha>"` zurückkommt (max. 4,5 Min)

Manuell triggern mit spezifischem Tag:
GitHub → Actions → Deploy → **Run workflow** → Tag eingeben (leer = aktueller SHA)

---

## Datenbank

```bash
# Verbindung
cd infra
psql "$(tofu output -raw database_connection_string | sed 's|postgresql+asyncpg|postgresql|')"

# Oder direkt mit Host/Port:
psql -h $(tofu output -raw rdb_host) \
     -p $(tofu output -raw rdb_port) \
     -U erfahre -d erfahre
```

```sql
-- Aktive Nutzer
SELECT id, email, display_name, role, is_blocked FROM users ORDER BY created_at DESC;

-- Check-ins heute
SELECT u.email, c.challenge_id, c.points, c.created_at
FROM checkins c JOIN users u ON u.id = c.user_id
WHERE c.created_at > now() - interval '1 day';

-- Rangliste
SELECT u.display_name, sum(c.points) AS punkte
FROM checkins c JOIN users u ON u.id = c.user_id
GROUP BY u.display_name ORDER BY punkte DESC LIMIT 10;

-- Nutzer sperren
UPDATE users SET is_blocked = true, blocked_reason = 'Missbrauch' WHERE email = 'x@y.de';
```

Logs: Scaleway Console → Serverless Containers → `biking-api` → Logs
