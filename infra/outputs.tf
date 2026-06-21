output "database_connection_string" {
  description = "PostgreSQL Connection String (sensitiv) – für GitHub Secret DATABASE_URL"
  value       = local.database_url
  sensitive   = true
}

output "rdb_host" {
  description = "RDB Host für pg_dump / psql"
  value       = local._rdb_host
}

output "rdb_port" {
  description = "RDB Port für pg_dump / psql"
  value       = local._rdb_port
}

output "registry_endpoint" {
  description = "Docker Registry Endpoint (für docker push)"
  value       = scaleway_registry_namespace.erfahre.endpoint
}

output "container_url" {
  description = "Automatisch generierte Container URL – als CNAME-Ziel für erfahre.openzirndorf.de verwenden"
  value       = scaleway_container.erfahre_api.public_endpoint
}

output "container_id" {
  description = "Scaleway Container UUID (für GitHub Secret SCW_CONTAINER_ID)"
  value       = scaleway_container.erfahre_api.id
}

output "app_url" {
  description = "Öffentliche App URL (Frontend + API)"
  value       = "https://${var.app_hostname}"
}
