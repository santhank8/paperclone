locals {
  tags = {
    Application = var.app_name
    ManagedBy   = "terraform"
  }
}
