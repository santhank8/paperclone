# Security group for ECS container instances.
# Allows inbound traffic only from the ALB on the ephemeral port range
# used by Docker bridge networking.

resource "aws_security_group" "app" {
  name        = "${var.app_name}-ecs-sg"
  description = "Allow inbound traffic from ALB on ephemeral ports"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 32768
    to_port         = 65535
    protocol        = "tcp"
    security_groups = [var.alb_sg_id]
    description     = "Ephemeral ports from ALB"
  }

  egress {
    from_port        = 0
    to_port          = 0
    protocol         = "-1"
    cidr_blocks      = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }

  tags = merge(var.tags, { Name = "${var.app_name}-ecs-sg" })
}
