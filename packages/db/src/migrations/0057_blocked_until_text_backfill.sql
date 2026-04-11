DO $$
DECLARE
  current_type text;
BEGIN
  SELECT data_type
  INTO current_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'issues'
    AND column_name = 'blocked_until';

  IF current_type = 'timestamp with time zone' THEN
    EXECUTE $sql$
      ALTER TABLE "issues"
        ALTER COLUMN "blocked_until" TYPE text
        USING CASE
          WHEN "blocked_until" IS NULL THEN NULL
          ELSE to_char("blocked_until", 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
        END
    $sql$;
  END IF;
END $$;
