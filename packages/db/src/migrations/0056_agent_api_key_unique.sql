DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM agent_api_keys
    GROUP BY key_hash HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Duplicate key_hash values exist in agent_api_keys. '
      'Resolve all duplicates (including revoked rows) before applying this migration. '
      'Query: SELECT key_hash, count(*) FROM agent_api_keys GROUP BY key_hash HAVING count(*) > 1;';
  END IF;
END $$;--> statement-breakpoint
DROP INDEX IF EXISTS "agent_api_keys_key_hash_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "agent_api_keys_key_hash_idx" ON "agent_api_keys" USING btree ("key_hash");
