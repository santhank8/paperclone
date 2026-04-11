output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer. Use this to access Paperclip when no custom domain is configured."
  value       = aws_lb.main.dns_name
}

output "app_url" {
  description = "Public URL for Paperclip."
  value       = var.domain_name != "" ? "https://${var.domain_name}" : "http://${aws_lb.main.dns_name}"
}

output "ecr_repository_url" {
  description = "ECR repository URL. Push the Paperclip Docker image here before starting the ECS service."
  value       = module.paperclip.ecr_repository_url
}

output "ecs_cluster_name" {
  description = "ECS cluster name."
  value       = module.paperclip.ecs_cluster_name
}

output "ecs_service_name" {
  description = "ECS service name."
  value       = module.paperclip.ecs_service_name
}

output "secrets_manager_arn" {
  description = "Secrets Manager secret ARN. Update DATABASE_URL and BETTER_AUTH_SECRET in this secret before the service can start successfully."
  value       = module.paperclip.secrets_manager_secret_arn
}

output "route53_nameservers" {
  description = "Route53 nameservers for your domain. Point your registrar's NS records here after apply."
  value       = var.domain_name != "" ? aws_route53_zone.app[0].name_servers : []
}
