variable "app_name" {
  description = "Application name prefix used for resource naming."
  type        = string
}

variable "aws_region" {
  description = "AWS region."
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type for ECS container hosts. Use t4g.* for Graviton (arm64)."
  type        = string
  default     = "t4g.medium"
}

variable "task_memory" {
  description = "Memory (MiB) reserved for the ECS task container."
  type        = number
  default     = 900
}

variable "ecr_repo_name" {
  description = "ECR repository name."
  type        = string
  default     = "paperclip"
}

variable "vpc_id" {
  description = "VPC ID to deploy into."
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for ECS instances and EFS mount targets."
  type        = list(string)
}

variable "alb_sg_id" {
  description = "Security group ID of the Application Load Balancer."
  type        = string
}

variable "initial_image_uri" {
  description = "Container image URI used when the ECS service is first created. CI/CD manages updates after the initial apply."
  type        = string
  default     = "public.ecr.aws/amazonlinux/amazonlinux:latest"
}

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default     = {}
}
