output "ecr_repository_url" {
  description = "ECR repository URL for the Paperclip image."
  value       = aws_ecr_repository.app.repository_url
}

output "ecs_cluster_name" {
  description = "ECS cluster name."
  value       = aws_ecs_cluster.app.name
}

output "ecs_service_name" {
  description = "ECS service name."
  value       = aws_ecs_service.app.name
}

output "target_group_arn" {
  description = "ALB target group ARN."
  value       = aws_lb_target_group.app.arn
}

output "secrets_manager_secret_arn" {
  description = "Secrets Manager secret ARN. Update DATABASE_URL and BETTER_AUTH_SECRET before starting the service."
  value       = aws_secretsmanager_secret.app.arn
}
