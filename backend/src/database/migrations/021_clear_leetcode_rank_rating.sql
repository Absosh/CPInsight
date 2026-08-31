UPDATE platform_accounts
SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'leetcodeProfile',
      COALESCE(metadata->'leetcodeProfile', '{}'::jsonb) || jsonb_build_object('ranking', rating)
    ),
    rating = NULL,
    max_rating = NULL,
    updated_at = NOW()
WHERE platform = 'leetcode'
  AND rating IS NOT NULL;
