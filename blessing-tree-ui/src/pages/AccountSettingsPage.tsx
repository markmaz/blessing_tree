import { useEffect, useState } from 'react';
import {
  fetchAccountSettings,
  updateAccountSettings,
} from '@/features/account/api/accountApi';
import type { AccountSettings } from '@/features/account/model/accountTypes';
import { AutoDismissAlert } from '@/shared/ui/AutoDismissAlert';

const defaultSettings: AccountSettings = {
  timezone: 'America/Chicago',
  dateFormat: 'MM_DD_YYYY',
  defaultLandingPage: 'DASHBOARD',
  emailNotificationsEnabled: true,
  createdAt: '',
  updatedAt: '',
};

export function AccountSettingsPage() {
  const [settings, setSettings] = useState<AccountSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      setIsLoading(true);
      setError(null);
      try {
        const nextSettings = await fetchAccountSettings();
        if (!cancelled) {
          setSettings(nextSettings);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load settings.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const nextSettings = await updateAccountSettings(settings);
      setSettings(nextSettings);
      setSuccess('Settings updated.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update settings.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="content-card">Loading settings...</div>;
  }

  return (
    <div className="vstack gap-4">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
        <div>
          <h1 className="h3 mb-1">Settings</h1>
          <p className="text-muted mb-0">
            Manage account-level preferences for your Blessing Tree session.
          </p>
        </div>
      </div>

      {success ? (
        <AutoDismissAlert
          message={success}
          onDismiss={() => setSuccess(null)}
          variant="success"
        />
      ) : null}
      {error ? <div className="alert alert-danger">{error}</div> : null}

      <div className="row g-4">
        <div className="col-12 col-xl-6">
          <section className="content-card h-100">
            <h2 className="h5 mb-3">Preferences</h2>
            <div className="vstack gap-3">
              <div>
                <label className="form-label" htmlFor="account-timezone">
                  Timezone
                </label>
                <input
                  id="account-timezone"
                  className="form-control"
                  value={settings.timezone}
                  onChange={(event) => setSettings((current) => ({ ...current, timezone: event.target.value }))}
                />
              </div>

              <div>
                <label className="form-label" htmlFor="account-date-format">
                  Date Format
                </label>
                <select
                  id="account-date-format"
                  className="form-select"
                  value={settings.dateFormat}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      dateFormat: event.target.value as AccountSettings['dateFormat'],
                    }))
                  }
                >
                  <option value="MM_DD_YYYY">MM/DD/YYYY</option>
                  <option value="YYYY_MM_DD">YYYY-MM-DD</option>
                </select>
              </div>

              <div>
                <label className="form-label" htmlFor="account-default-landing-page">
                  Default Landing Page
                </label>
                <select
                  id="account-default-landing-page"
                  className="form-select"
                  value={settings.defaultLandingPage}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      defaultLandingPage: event.target.value as AccountSettings['defaultLandingPage'],
                    }))
                  }
                >
                  <option value="DASHBOARD">Dashboard</option>
                  <option value="CAMPAIGNS">Campaigns</option>
                  <option value="CURRENT_CAMPAIGN">Current Campaign</option>
                </select>
              </div>

              <div className="form-check form-switch">
                <input
                  id="account-email-notifications"
                  className="form-check-input"
                  type="checkbox"
                  checked={settings.emailNotificationsEnabled}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      emailNotificationsEnabled: event.target.checked,
                    }))
                  }
                />
                <label className="form-check-label" htmlFor="account-email-notifications">
                  Email notifications enabled
                </label>
              </div>
            </div>

            <div className="d-flex justify-content-end mt-4">
              <button
                type="button"
                className="btn btn-primary"
                disabled={isSaving || !settings.timezone.trim()}
                onClick={() => void handleSave()}
              >
                <i className="bi bi-save me-2" aria-hidden="true" />
                {isSaving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </section>
        </div>

        <div className="col-12 col-xl-6">
          <section className="content-card h-100">
            <h2 className="h5 mb-3">Sign-In</h2>
            <p className="text-muted">
              Password changes are still handled through the invitation onboarding flow. This
              screen now owns durable user preferences.
            </p>
            <div className="d-flex flex-wrap gap-2">
              <span className="badge text-bg-light">
                <i className="bi bi-shield-lock me-1" aria-hidden="true" />
                Protected Session
              </span>
              <span className="badge text-bg-light">
                <i className="bi bi-arrow-repeat me-1" aria-hidden="true" />
                Refresh Cookie Enabled
              </span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
