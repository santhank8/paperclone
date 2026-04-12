CREATE UNIQUE INDEX "issues_open_board_copilot_thread_uq" ON "issues" USING btree ("company_id","origin_kind","origin_id") WHERE "issues"."origin_kind" = 'board_copilot_thread'
          and "issues"."origin_id" is not null
          and "issues"."hidden_at" is null;