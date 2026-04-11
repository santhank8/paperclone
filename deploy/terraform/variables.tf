variable "aws_region" {
  description = "AWS region to deploy into."
  type        = string
  default     = "us-east-1"
}

variable "app_name" {
  description = "Application name prefix used for all resource names."
  type        = string
  default     = "paperclip"
}

variable "instance_type" {
  description = "EC2 instance type for ECS container hosts. t4g.* instances use AWS Graviton (arm64), matching the Paperclip Docker image architecture."
  type        = string
  default     = "t4g.medium"
}

variable "task_memory" {
  description = "Memory (MiB) reserved for the Paperclip ECS task container."
  type        = number
  default     = 900
}

variable "ecr_repo_name" {
  description = "ECR repository name for the Paperclip Docker image."
  type        = string
  default     = "paperclip"
}

variable "domain_name" {
  description = "Custom domain for Paperclip (e.g. paperclip.example.com). Leave empty to access via the ALB DNS name over HTTP. When set, Route53, ACM certificate, and HTTPS listener are created automatically."
  type        = string
  default     = ""
}

variable "paperclip_image_uri" {
  description = "Initial container image URI bootstrapped into the ECS task definition. After the first apply, push your image to ECR and update the ECS service via CI/CD."
  type        = string
  default     = "public.ecr.aws/amazonlinux/amazonlinux:latest"
}
