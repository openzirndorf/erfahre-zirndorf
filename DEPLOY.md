# Deployment: Erfahre Zirndorf

**Architektur:** Ein einziger Scaleway Serverless Container liefert Frontend + API.
- `https://erfahre.openzirndorf.de/` → React SPA
- `https://erfahre.openzirndorf.de/api/` → FastAPI
- Datenbank: Scaleway Serverless SQL (PostgreSQL)

---

## Lokal entwickeln

```bash
docker compose up
# Backend:  http://localhost:8000/api/docs
# Frontend: http://localhost:5173 (eigener Vite-Dev-Server mit Proxy)

# Datenbank befüllen
docker exec biking-backend-1 python3 seed.py --no-testusers
```

---

## Einmalige Einrichtung

### DNS

Nach `tofu apply` den `container_url`-Output als CNAME-Ziel verwenden:

```
erfahre.openzirndorf.de  CNAME  <container_url aus tofu output>
```

Scaleway stellt das TLS-Zertifikat automatisch via Let's Encrypt aus,
sobald der CNAME gesetzt ist und `tofu apply` die Custom Domain anlegt.

### GitHub Actions Secrets

### Assets-Repo einrichten (einmalig)

Das private Repo `openzirndorf/erfahre-assets` enthält:
```
challenges.json
images/
  <uuid>.png   ← Ortsbilder
```

Einen **Fine-grained PAT** erstellen:
GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
→ Repository access: nur `erfahre-assets` → Permission: Contents (Read-only)

Diesen Token als Secret `ASSETS_TOKEN` im `erfahre`-Repo hinterlegen.

### Secrets im `erfahre`-Repo (Settings → Secrets → Actions)

| Secret | Wert |
|--------|------|
| `ASSETS_TOKEN` | Fine-grained PAT für `erfahre-assets` (Read) |
| `SCW_ACCESS_KEY` | Scaleway Access Key |
| `SCW_SECRET_KEY` | Scaleway Secret Key |
| `SCW_PROJECT_ID` | Scaleway Project ID |
| `SCW_REGISTRY_ENDPOINT` | Ausgabe von `tofu output registry_endpoint` |
| `APP_SECRET_KEY` | `openssl rand -hex 32` |
| `APP_ADMIN_TOKEN` | `openssl rand -hex 24` |
| `ALTCHA_HMAC_KEY` | `openssl rand -hex 32` |
| `FIRST_ADMIN_EMAIL` | Admin-E-Mail-Adresse |

---

## Erstmalig deployen

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars
# terraform.tfvars befüllen

tofu init
tofu apply
```

Outputs notieren:
```bash
tofu output registry_endpoint   # → in GitHub Secret SCW_REGISTRY_ENDPOINT
tofu output container_url       # → als CNAME-Ziel beim DNS-Hoster eintragen
```

Ab dann übernimmt GitHub Actions jeden Push auf `main`.

### Datenbank befüllen (einmalig)

```bash
export DATABASE_URL=$(tofu -chdir=infra output -raw database_connection_string)
export SECRET_KEY=<aus terraform.tfvars>
export ADMIN_TOKEN=<aus terraform.tfvars>

cd backend
pip install -r requirements.txt
python3 seed.py --no-testusers
```

---

## Erster Admin-Nutzer

`FIRST_ADMIN_EMAIL` als GitHub Secret hinterlegen (wird als Container-Env gesetzt).
Beim ersten Login mit dieser E-Mail erhält der Account automatisch Admin-Rolle.

---

## Umgebungsvariablen

| Variable | Pflicht | Beschreibung |
|---|---|---|
| `DATABASE_URL` | ✓ | PostgreSQL Connection String (via Tofu) |
| `SECRET_KEY` | ✓ | JWT-Schlüssel (`openssl rand -hex 32`) |
| `ADMIN_TOKEN` | ✓ | Bearer Token Admin-Endpunkte |
| `ALTCHA_HMAC_KEY` | ✓ | Anti-Spam Schlüssel (`openssl rand -hex 32`) |
| `CORS_ORIGINS` | ✓ | App-URL (via Tofu: `app_url`) |
| `FIRST_ADMIN_EMAIL` | empfohlen | E-Mail für automatische Admin-Rolle |
| `EVENT_START` | – | Standard: `2026-06-06` |
| `EVENT_END` | – | Standard: `2026-06-28` |
| `DEBUG` | – | `false` in Produktion |
