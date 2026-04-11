resource "aws_ecs_cluster" "app" {
  name = var.app_name

  setting {
    name  = "containerInsights"
    value = "disabled"
  }

  tags = var.tags
}

resource "aws_ecs_capacity_provider" "app" {
  name = "${var.app_name}-cp"

  auto_scaling_group_provider {
    auto_scaling_group_arn         = aws_autoscaling_group.app.arn
    managed_termination_protection = "DISABLED"

    managed_scaling {
      status          = "ENABLED"
      target_capacity = 100
    }
  }
}

resource "aws_ecs_cluster_capacity_providers" "app" {
  cluster_name       = aws_ecs_cluster.app.name
  capacity_providers = [aws_ecs_capacity_provider.app.name]

  default_capacity_provider_strategy {
    capacity_provider = aws_ecs_capacity_provider.app.name
    weight            = 1
    base              = 1
  }
}

resource "aws_ecs_task_definition" "app" {
  family                   = "${var.app_name}-app"
  network_mode             = "bridge"
  requires_compatibilities = ["EC2"]
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([
    {
      name              = "${var.app_name}-app"
      image             = var.initial_image_uri
      essential         = true
      memoryReservation = var.task_memory

      portMappings = [
        { containerPort = 3100, protocol = "tcp" }
      ]

      environment = [
        { name = "ENVIRONMENT",                   value = "production" },
        { name = "LOG_LEVEL",                     value = "INFO" },
        { name = "AWS_REGION",                    value = var.aws_region },
        { name = "PORT",                          value = "3100" },
        { name = "HOST",                          value = "0.0.0.0" },
        { name = "SERVE_UI",                      value = "true" },
        { name = "PAPERCLIP_DEPLOYMENT_MODE",     value = "authenticated" },
        { name = "PAPERCLIP_DEPLOYMENT_EXPOSURE", value = "private" },
        { name = "SECRET_NAME",                   value = aws_secretsmanager_secret.app.name },
      ]

      # Secrets are fetched from Secrets Manager at task start and injected
      # as environment variables. Update the secret values before the first deploy.
      secrets = [
        { name = "DATABASE_URL",                         valueFrom = "${aws_secretsmanager_secret.app.arn}:DATABASE_URL::" },
        { name = "BETTER_AUTH_SECRET",                   valueFrom = "${aws_secretsmanager_secret.app.arn}:BETTER_AUTH_SECRET::" },
        { name = "PAPERCLIP_AUTH_ALLOWED_EMAIL_DOMAINS", valueFrom = "${aws_secretsmanager_secret.app.arn}:PAPERCLIP_AUTH_ALLOWED_EMAIL_DOMAINS::" },
        { name = "ANTHROPIC_API_KEY",                    valueFrom = "${aws_secretsmanager_secret.app.arn}:ANTHROPIC_API_KEY::" },
        { name = "OPENAI_API_KEY",                       valueFrom = "${aws_secretsmanager_secret.app.arn}:OPENAI_API_KEY::" },
      ]

      mountPoints = [
        { sourceVolume = "paperclip-data", containerPath = "/paperclip", readOnly = false }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.app.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])

  volume {
    name = "paperclip-data"

    efs_volume_configuration {
      file_system_id          = aws_efs_file_system.app.id
      transit_encryption      = "ENABLED"
      authorization_config {
        access_point_id = aws_efs_access_point.app.id
        iam             = "ENABLED"
      }
    }
  }

  tags = var.tags
}

resource "aws_ecs_service" "app" {
  name                              = "${var.app_name}-app"
  cluster                           = aws_ecs_cluster.app.id
  task_definition                   = aws_ecs_task_definition.app.arn
  desired_count                     = 1
  enable_execute_command            = true
  health_check_grace_period_seconds = 60

  capacity_provider_strategy {
    capacity_provider = aws_ecs_capacity_provider.app.name
    weight            = 1
    base              = 1
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = "${var.app_name}-app"
    container_port   = 3100
  }

  # Prevent terraform from reverting image updates made by CI/CD.
  lifecycle {
    ignore_changes = [task_definition, desired_count]
  }

  depends_on = [aws_ecs_cluster_capacity_providers.app]
}
