module "paperclip" {
  source = "./modules/paperclip"

  app_name           = var.app_name
  aws_region         = var.aws_region
  instance_type      = var.instance_type
  task_memory        = var.task_memory
  ecr_repo_name      = var.ecr_repo_name
  vpc_id             = aws_vpc.main.id
  private_subnet_ids = [aws_subnet.private_a.id, aws_subnet.private_b.id]
  alb_sg_id          = aws_security_group.alb.id
  initial_image_uri  = var.paperclip_image_uri
  tags               = local.tags
}
