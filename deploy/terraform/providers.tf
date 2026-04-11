terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Recommended: store state in S3.
  # Run bootstrap/ first to create the bucket, then fill in the values below.
  # backend "s3" {
  #   bucket       = "mycompany-paperclip-tfstate"
  #   key          = "paperclip/terraform.tfstate"
  #   region       = "us-east-1"
  #   encrypt      = true
  #   use_lockfile = true
  # }
}

provider "aws" {
  region = var.aws_region
}
