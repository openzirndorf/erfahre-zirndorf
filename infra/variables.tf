variable "scw_access_key" {
  description = "Scaleway Access Key"
  type        = string
  sensitive   = true
}

variable "scw_secret_key" {
  description = "Scaleway Secret Key"
  type        = string
  sensitive   = true
}

variable "scw_project_id" {
  description = "Scaleway Project ID"
  type        = string
}

variable "scw_region" {
  description = "Scaleway Region"
  type        = string
  default     = "fr-par"
}

variable "db_password" {
  description = "Passwort für den PostgreSQL-User 'erfahre' (min. 16 Zeichen, openssl rand -hex 16)"
  type        = string
  sensitive   = true
}

variable "secret_key" {
  description = "JWT Secret Key (langer zufälliger String)"
  type        = string
  sensitive   = true
}

variable "admin_token" {
  description = "Bearer Token für Admin-Endpunkte"
  type        = string
  sensitive   = true
}

variable "container_image_tag" {
  description = "Docker Image Tag der API"
  type        = string
  default     = "latest"
}

variable "app_url" {
  description = "Öffentliche URL der App (Frontend + API, gleiche Domain)"
  type        = string
  default     = "https://erfahre.openzirndorf.de"
}

variable "app_hostname" {
  description = "Custom Domain (DNS CNAME auf Scaleway Container URL setzen)"
  type        = string
  default     = "erfahre.openzirndorf.de"
}

variable "event_start" {
  description = "Startdatum des Aktionszeitraums (YYYY-MM-DD)"
  type        = string
  default     = "2026-06-06"
}

variable "event_end" {
  description = "Enddatum des Aktionszeitraums (YYYY-MM-DD)"
  type        = string
  default     = "2026-07-05"
}

variable "first_admin_email" {
  description = "E-Mail-Adresse, die beim ersten Login automatisch Admin-Rolle erhält"
  type        = string
  default     = ""
}

variable "altcha_hmac_key" {
  description = "HMAC-Schlüssel für Altcha Proof-of-Work (openssl rand -hex 32)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "smtp_user" {
  description = "Scaleway Project ID (= SMTP User für Transactional Email)"
  type        = string
  default     = ""
}

variable "smtp_password" {
  description = "Scaleway Secret Key (= SMTP Password für Transactional Email)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "smtp_from" {
  description = "Absender-Adresse (muss in Scaleway TEM verifiziert sein)"
  type        = string
  default     = "noreply@automail.openzirndorf.de"
}

variable "altcha_disabled" {
  description = "Altcha Spam-Schutz deaktivieren (true bei Widget-Problemen)"
  type        = string
  default     = "false"
}
