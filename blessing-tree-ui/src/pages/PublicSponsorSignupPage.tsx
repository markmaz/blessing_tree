import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getPublicSponsorConfig, submitPublicSponsorRegistration } from '@/features/campaigns/api/publicSponsorApi';
import type {
  PublicSponsorConfig,
  PublicSponsorRegistrationInput,
  PublicSponsorRegistrationResult,
} from '@/features/campaigns/model/publicSponsorTypes';
import { formatShortDate } from '@/features/campaigns/model/campaignSponsorWorkspacePresentation';
import '@/features/campaigns/ui/publicSponsors.css';

const emptyForm: PublicSponsorRegistrationInput = {
  firstName: '',
  lastName: '',
  organizationName: '',
  email: '',
  phone: '',
  preferredContact: 'EMAIL',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  notes: '',
  selectedWishlistItemIds: [],
  source: 'PUBLIC_LINK',
};

export function PublicSponsorSignupPage() {
  const { publicSlug = '' } = useParams();
  const [config, setConfig] = useState<PublicSponsorConfig | null>(null);
  const [form, setForm] = useState<PublicSponsorRegistrationInput>(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PublicSponsorRegistrationResult | null>(null);

  useEffect(() => {
    let isActive = true;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await getPublicSponsorConfig(publicSlug);
        if (!isActive) {
          return;
        }
        setConfig(response);
      } catch (loadError) {
        if (!isActive) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : 'Unable to load sponsor signup.');
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void load();
    return () => {
      isActive = false;
    };
  }, [publicSlug]);

  const isRegistrationOpen = config?.registration.status === 'OPEN';

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!config || !isRegistrationOpen) {
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await submitPublicSponsorRegistration(publicSlug, {
        ...form,
        selectedWishlistItemIds: [],
      });
      setResult(response);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit sponsor registration.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <div className="public-sponsor-shell"><p className="text-muted">Loading sponsor registration...</p></div>;
  }

  if (error && !config) {
    return (
      <div className="public-sponsor-shell">
        <div className="public-sponsor-layout">
          <div className="alert alert-danger" role="alert">{error}</div>
        </div>
      </div>
    );
  }

  if (!config) {
    return null;
  }

  return (
    <div className="public-sponsor-shell">
      <div className="public-sponsor-layout">
        <section className="public-sponsor-hero">
          <div className="public-sponsor-brand-row">
            <img
              src="/blessing_tree_logo_transparent_v3.png"
              alt="Blessing Tree"
              className="public-sponsor-logo"
            />
            <div>
              <div className="text-uppercase small text-muted fw-semibold mb-2">Blessing Tree Sponsor Signup</div>
              <h1 className="h3 mb-1">{config.campaign.name}</h1>
              <p className="text-muted mb-0">
                {config.campaign.seasonTheme
                  ? `${config.campaign.seasonTheme} · `
                  : ''}
                Register to sponsor gifts for this campaign.
              </p>
            </div>
            <div className="public-sponsor-hero__status">
              <span className="public-sponsor-badge">
                <i className="bi bi-calendar-event" aria-hidden="true" />
                <span>{config.registration.message}</span>
              </span>
            </div>
          </div>
        </section>

        {result ? (
          <section className="public-sponsor-card">
            <h2 className="h5 mb-2">Check Your Email</h2>
            <p className="text-muted mb-3">{result.message}</p>
            <p className="mb-0">
              After you verify your email address, you’ll choose gifts from the confirmation page.
            </p>
            <div className="public-sponsor-item__meta">
              {result.email ? (
                <span className="public-sponsor-badge">
                  <i className="bi bi-envelope-check" aria-hidden="true" />
                  <span>{result.email}</span>
                </span>
              ) : null}
              {result.expiresAt ? (
                <span className="public-sponsor-badge">
                  <i className="bi bi-hourglass-split" aria-hidden="true" />
                  <span>Expires {formatShortDate(result.expiresAt)}</span>
                </span>
              ) : null}
            </div>
          </section>
        ) : (
          <div className="public-sponsor-grid public-sponsor-grid--signup">
            <section className="public-sponsor-card">
              <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
                <div>
                  <h2 className="h5 mb-1">Your Information</h2>
                  <p className="text-muted mb-0">We’ll verify your email before showing gift reservations.</p>
                </div>
                {config.giftDeadline ? (
                  <span className="public-sponsor-badge">
                    <i className="bi bi-gift" aria-hidden="true" />
                    <span>Gift deadline {formatShortDate(config.giftDeadline)}</span>
                  </span>
                ) : null}
              </div>

              {error ? (
                <div className="alert alert-danger" role="alert">{error}</div>
              ) : null}

              <form onSubmit={handleSubmit}>
                <div className="public-sponsor-form-grid">
                  <label className="form-label">
                    First Name
                    <input
                      className="form-control"
                      value={form.firstName}
                      onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
                      required
                    />
                  </label>
                  <label className="form-label">
                    Last Name
                    <input
                      className="form-control"
                      value={form.lastName}
                      onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
                      required
                    />
                  </label>
                  <label className="form-label public-span-2">
                    Organization Name
                    <input
                      className="form-control"
                      value={form.organizationName}
                      onChange={(event) => setForm((current) => ({ ...current, organizationName: event.target.value }))}
                    />
                  </label>
                  <label className="form-label">
                    Email
                    <input
                      type="email"
                      className="form-control"
                      value={form.email}
                      onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                      required
                    />
                  </label>
                  <label className="form-label">
                    Phone
                    <input
                      className="form-control"
                      value={form.phone}
                      onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                    />
                  </label>
                  <label className="form-label">
                    Preferred Contact
                    <select
                      className="form-select"
                      value={form.preferredContact}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          preferredContact: event.target.value as PublicSponsorRegistrationInput['preferredContact'],
                        }))
                      }
                    >
                      <option value="EMAIL">Email</option>
                      <option value="PHONE">Phone</option>
                      <option value="TEXT">Text</option>
                      <option value="NONE">No Preference</option>
                    </select>
                  </label>
                  <label className="form-label public-span-2">
                    Address Line 1
                    <input
                      className="form-control"
                      value={form.addressLine1}
                      onChange={(event) => setForm((current) => ({ ...current, addressLine1: event.target.value }))}
                    />
                  </label>
                  <label className="form-label public-span-2">
                    Address Line 2
                    <input
                      className="form-control"
                      value={form.addressLine2}
                      onChange={(event) => setForm((current) => ({ ...current, addressLine2: event.target.value }))}
                    />
                  </label>
                  <label className="form-label">
                    City
                    <input
                      className="form-control"
                      value={form.city}
                      onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
                    />
                  </label>
                  <label className="form-label">
                    State
                    <input
                      className="form-control"
                      value={form.state}
                      onChange={(event) => setForm((current) => ({ ...current, state: event.target.value }))}
                    />
                  </label>
                  <label className="form-label">
                    ZIP
                    <input
                      className="form-control"
                      value={form.postalCode}
                      onChange={(event) => setForm((current) => ({ ...current, postalCode: event.target.value }))}
                    />
                  </label>
                  <label className="form-label public-span-2">
                    Notes
                    <textarea
                      className="form-control"
                      rows={3}
                      value={form.notes}
                      onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                    />
                  </label>
                </div>

                <div className="public-sponsor-card__footer">
                  <div className="text-muted small">
                    Gift selection happens after email verification.
                  </div>
                  <button
                    type="submit"
                    className="btn btn-secondary"
                    disabled={!isRegistrationOpen || isSubmitting}
                  >
                    <i className="bi bi-envelope-paper-heart me-2" aria-hidden="true" />
                    {isSubmitting ? 'Submitting...' : 'Submit Sponsor Signup'}
                  </button>
                </div>
              </form>
            </section>

            <aside className="public-sponsor-card public-sponsor-process-card">
              <div className="public-sponsor-process-step">
                <i className="bi bi-envelope-check" aria-hidden="true" />
                <div>
                  <strong>Verify your email</strong>
                  <span>We send a secure link to confirm the address belongs to you.</span>
                </div>
              </div>
              <div className="public-sponsor-process-step">
                <i className="bi bi-search-heart" aria-hidden="true" />
                <div>
                  <strong>Search available gifts</strong>
                  <span>After verification, use natural language like coats for girls age 8.</span>
                </div>
              </div>
              <div className="public-sponsor-process-step">
                <i className="bi bi-bag-check" aria-hidden="true" />
                <div>
                  <strong>Reserve your gifts</strong>
                  <span>Your choices are committed once you confirm them on the verified page.</span>
                </div>
              </div>
            </aside>
          </div>
        )}

        <div className="text-center text-muted small">
          Already verified? Check your email for the verification link. Need help? Contact the campaign team directly.
        </div>
        <div className="text-center">
          <Link to="/" className="btn btn-outline-secondary btn-sm">
            <i className="bi bi-house-door me-2" aria-hidden="true" />
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}
