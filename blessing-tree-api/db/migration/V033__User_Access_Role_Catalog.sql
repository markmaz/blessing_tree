UPDATE IGNORE campaign_user_role
SET role_key = 'PEOPLE_MANAGER'
WHERE role_key = 'RECIPIENT_COORDINATOR';

UPDATE IGNORE campaign_user_role
SET role_key = 'GIFT_OPERATIONS'
WHERE role_key = 'GIFT_CHECKIN';

UPDATE IGNORE campaign_user_role
SET role_key = 'CAMPAIGN_VIEWER'
WHERE role_key = 'VOLUNTEER_VIEWER';

UPDATE IGNORE campaign_member_access_role
SET role_key = 'PEOPLE_MANAGER'
WHERE role_key = 'RECIPIENT_COORDINATOR';

UPDATE IGNORE campaign_member_access_role
SET role_key = 'GIFT_OPERATIONS'
WHERE role_key = 'GIFT_CHECKIN';

UPDATE IGNORE campaign_member_access_role
SET role_key = 'CAMPAIGN_VIEWER'
WHERE role_key = 'VOLUNTEER_VIEWER';
