DELETE FROM app_feature_flag
WHERE feature_key = 'families'
  AND EXISTS (
    SELECT 1
    FROM (
      SELECT feature_key
      FROM app_feature_flag
      WHERE feature_key = 'people'
    ) AS existing_people
  );

UPDATE app_feature_flag
SET feature_key = 'people',
    label = 'People',
    description = 'Show the campaign-aware People workspace in the main application navigation.'
WHERE feature_key = 'families';
