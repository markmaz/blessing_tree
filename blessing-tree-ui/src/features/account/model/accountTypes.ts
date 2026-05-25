export interface AccountProfile {
  id: string;
  email: string;
  displayName: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccountSettings {
  timezone: string;
  dateFormat: 'MM_DD_YYYY' | 'YYYY_MM_DD';
  defaultLandingPage: 'DASHBOARD' | 'CAMPAIGNS' | 'CURRENT_CAMPAIGN';
  emailNotificationsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}
