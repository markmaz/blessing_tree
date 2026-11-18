-- Make the privacy-safe setting the default for every existing recipient.
-- The recipient table already defaults new rows to ANONYMOUS.
UPDATE recipient
SET privacy_level = 'ANONYMOUS'
WHERE privacy_level <> 'ANONYMOUS';
