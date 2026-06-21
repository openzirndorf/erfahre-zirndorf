terraform {
  required_providers {
    scaleway = {
      source  = "scaleway/scaleway"
      version = "~> 2.49"
    }
  }
  required_version = ">= 1.6"
}

provider "scaleway" {
  access_key = var.scw_access_key
  secret_key = var.scw_secret_key
  project_id = var.scw_project_id
  region     = var.scw_region
}

# ── Managed PostgreSQL (RDB) ────────────────────────────────────────────────
# db-dev-s: 1 vCPU, 1 GB RAM, 10 GB Storage, ~3 €/Monat (flat)

resource "scaleway_rdb_instance" "erfahre" {
  name           = "entdecke-zirndorf"
  node_type      = "db-dev-s"
  engine         = "PostgreSQL-16"
  is_ha_cluster  = false
  disable_backup = true
  region         = var.scw_region
}

resource "scaleway_rdb_database" "erfahre" {
  instance_id = scaleway_rdb_instance.erfahre.id
  name        = "erfahre"
  region      = var.scw_region
}

resource "scaleway_rdb_user" "erfahre" {
  instance_id = scaleway_rdb_instance.erfahre.id
  name        = "erfahre"
  password    = var.db_password
  is_admin    = false
  region      = var.scw_region
}

resource "scaleway_rdb_privilege" "erfahre" {
  instance_id   = scaleway_rdb_instance.erfahre.id
  database_name = scaleway_rdb_database.erfahre.name
  user_name     = scaleway_rdb_user.erfahre.name
  permission    = "all"
  region        = var.scw_region
}

locals {
  _rdb_host    = try(scaleway_rdb_instance.erfahre.load_balancer[0].ip, "")
  _rdb_port    = try(scaleway_rdb_instance.erfahre.load_balancer[0].port, 5432)
  database_url = "postgresql+asyncpg://${scaleway_rdb_user.erfahre.name}:${var.db_password}@${local._rdb_host}:${local._rdb_port}/${scaleway_rdb_database.erfahre.name}"
}

# ── Container Registry ─────────────────────────────────────────────────────

resource "scaleway_registry_namespace" "erfahre" {
  name      = "entdecke-zirndorf"
  region    = var.scw_region
  is_public = false
}

# ── Serverless Container Namespace ─────────────────────────────────────────

resource "scaleway_container_namespace" "erfahre_ns" {
  name   = "entdecke-zirndorf"
  region = var.scw_region
}

# ── Serverless Container – FastAPI Backend ─────────────────────────────────

resource "scaleway_container" "erfahre_api" {
  name         = "biking-api"
  namespace_id = scaleway_container_namespace.erfahre_ns.id
  image        = "${scaleway_registry_namespace.erfahre.endpoint}/erfahre-api:${var.container_image_tag}"

  port               = 8080
  cpu_limit          = 1000
  memory_limit_bytes = 1073741824
  min_scale          = 0
  max_scale          = 5

  secret_environment_variables = {
    DATABASE_URL    = local.database_url
    SECRET_KEY      = var.secret_key
    ADMIN_TOKEN     = var.admin_token
    ALTCHA_HMAC_KEY = var.altcha_hmac_key
    SMTP_PASSWORD   = var.smtp_password
  }

  environment_variables = {
    CORS_ORIGINS      = var.app_url
    FRONTEND_URL      = var.app_url
    EVENT_START       = var.event_start
    EVENT_END         = var.event_end
    FIRST_ADMIN_EMAIL = var.first_admin_email
    ALTCHA_DISABLED   = var.altcha_disabled
    SMTP_HOST         = "smtp.tem.scaleway.com"
    SMTP_PORT         = "465"
    SMTP_USER         = var.smtp_user
    SMTP_FROM         = var.smtp_from
  }

  privacy = "public"

  depends_on = [scaleway_rdb_privilege.erfahre]
}

# ── Custom Domain ───────────────────────────────────────────────────────────

resource "scaleway_container_domain" "app" {
  container_id = scaleway_container.erfahre_api.id
  hostname     = var.app_hostname
  region       = var.scw_region
}
