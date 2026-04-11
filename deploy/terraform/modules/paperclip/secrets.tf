resource "aws_secretsmanager_secret" "app" {
  name        = "${var.app_name}-secrets"
  description = "Runtime secrets for Paperclip. Update these values before starting the ECS service."
  tags        = var.tags
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id

  # Placeholder values — update these via the AWS Console or CLI before the
  # ECS service starts. The lifecycle block prevents terraform from
  # overwriting values you update outside of terraform.
  secret_string = jsonencode({
    DATABASE_URL                         = "SET_ME"
    BETTER_AUTH_SECRET                   = "SET_ME"
    PAPERCLIP_AUTH_ALLOWED_EMAIL_DOMAINS = ""
    ANTHROPIC_API_KEY                    = "SET_ME"
    OPENAI_API_KEY                       = "SET_ME"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}
