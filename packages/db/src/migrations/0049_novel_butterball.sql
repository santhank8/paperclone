UPDATE "approvals"
SET
  "status" = 'completed',
  "updated_at" = now()
WHERE "status" = 'approved';
