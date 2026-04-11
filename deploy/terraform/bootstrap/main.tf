# Creates the S3 bucket used to store Terraform remote state.
# Run this once before applying the main configuration.
#
#   cd bootstrap/
#   terraform init
#   terraform apply -var="project_name=mycompany-paperclip"
#
# Then uncomment the backend "s3" block in ../providers.tf and run:
#   cd ..
#   terraform init

resource "aws_s3_bucket" "tfstate" {
  bucket = "${var.project_name}-tfstate"

  lifecycle {
    prevent_destroy = true
  }

  tags = {
    ManagedBy = "terraform"
  }
}

resource "aws_s3_bucket_versioning" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "tfstate" {
  bucket                  = aws_s3_bucket.tfstate.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

output "tfstate_bucket_name" {
  description = "S3 bucket name — set this as the bucket value in the backend config of the main configuration."
  value       = aws_s3_bucket.tfstate.id
}
