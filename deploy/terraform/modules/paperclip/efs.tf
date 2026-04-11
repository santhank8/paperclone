# Encrypted EFS file system mounted at /paperclip inside the container.
# Stores instance data, config, and agent workspaces across container restarts.

resource "aws_security_group" "efs" {
  name        = "${var.app_name}-efs-sg"
  description = "Allow NFS traffic from ECS instances"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 2049
    to_port         = 2049
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
    description     = "NFS from ECS instances"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, { Name = "${var.app_name}-efs-sg" })
}

resource "aws_efs_file_system" "app" {
  encrypted        = true
  creation_token   = "${var.app_name}-efs"
  performance_mode = "generalPurpose"
  throughput_mode  = "bursting"

  tags = merge(var.tags, { Name = "${var.app_name}-efs" })
}

resource "aws_efs_mount_target" "app" {
  for_each = toset(var.private_subnet_ids)

  file_system_id  = aws_efs_file_system.app.id
  subnet_id       = each.value
  security_groups = [aws_security_group.efs.id]
}

resource "aws_efs_access_point" "app" {
  file_system_id = aws_efs_file_system.app.id

  root_directory {
    path = "/${var.app_name}"
    creation_info {
      owner_uid   = 1000
      owner_gid   = 1000
      permissions = "0755"
    }
  }

  posix_user {
    uid = 1000
    gid = 1000
  }

  tags = merge(var.tags, { Name = "${var.app_name}-efs-ap" })
}
