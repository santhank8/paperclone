variable "aws_region" {
  description = "AWS region for the state bucket."
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name prefix for the S3 state bucket (e.g. mycompany-paperclip). Must be globally unique."
  type        = string
}
