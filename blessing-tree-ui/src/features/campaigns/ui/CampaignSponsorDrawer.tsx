import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { CampaignStudioDrawer } from '@/features/campaigns/ui/CampaignStudioDrawer';
import { FieldHelpButton } from '@/features/ask/ui/FieldHelpButton';
import type {
  CampaignSponsor,
  CampaignSponsorInteraction,
  SponsorCommunicationPreview,
  SponsorCommunicationSendResult,
  SponsorInteractionUpsertInput,
  SponsorPreferredContact,
  SponsorUpsertInput,
  SponsorshipUpsertInput,
} from '@/features/campaigns/model/campaignSponsorWorkspaceTypes';
import type { CommunicationTemplate } from '@/features/campaigns/model/campaignStudioTypes';
import {
  formatShortDate,
  getMostRecentSponsorInteraction,
  summarizeFollowUp,
  summarizeSponsorInteraction,
  toSponsorInteractionOriginLabel,
  toSponsorPreferredContactLabel,
  toSponsorStatusLabel,
} from '@/features/campaigns/model/campaignSponsorWorkspacePresentation';
import { ConfirmationModal } from '@/shared/ui/ConfirmationModal';

interface CampaignSponsorDrawerProps {
  campaignId?: string | null;
  isOpen: boolean;
  canEdit: boolean;
  isSaving: boolean;
  sponsor: CampaignSponsor | null;
  communicationTemplates: CommunicationTemplate[];
  communicationTemplateError: string | null;
  interactionsState?: {
    items: CampaignSponsorInteraction[];
    isLoading: boolean;
    error: string | null;
    loaded: boolean;
  };
  onLoadInteractions: (sponsorId: string) => Promise<CampaignSponsorInteraction[]>;
  onPreviewCommunication: (
    sponsorId: string,
    templateId: string
  ) => Promise<SponsorCommunicationPreview | null>;
  onSendCommunication: (
    sponsorId: string,
    templateId: string
  ) => Promise<SponsorCommunicationSendResult | null>;
  onSaveSponsor: (
    sponsor: SponsorUpsertInput,
    participation: SponsorshipUpsertInput,
    sponsorId?: string
  ) => Promise<CampaignSponsor | null>;
  onDeleteSponsor: (sponsorId: string) => Promise<boolean>;
  onSaveInteraction: (
    sponsorId: string,
    input: SponsorInteractionUpsertInput,
    interactionId?: string
  ) => Promise<CampaignSponsorInteraction | null>;
  onDeleteInteraction: (sponsorId: string, interactionId: string) => Promise<boolean>;
  onClose: () => void;
  onSaved: (sponsor: CampaignSponsor) => void;
}

export function CampaignSponsorDrawer({
  campaignId,
  isOpen,
  canEdit,
  isSaving,
  sponsor,
  communicationTemplates,
  communicationTemplateError,
  interactionsState,
  onLoadInteractions,
  onPreviewCommunication,
  onSendCommunication,
  onSaveSponsor,
  onDeleteSponsor,
  onSaveInteraction,
  onDeleteInteraction,
  onClose,
  onSaved,
}: CampaignSponsorDrawerProps) {
  const [form, setForm] = useState<SponsorUpsertInput>(createEmptySponsorForm());
  const [participation, setParticipation] = useState<SponsorshipUpsertInput>(createEmptyParticipationForm());
  const [localError, setLocalError] = useState<string | null>(null);
  const [localSuccess, setLocalSuccess] = useState<string | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleteSubmitting, setIsDeleteSubmitting] = useState(false);
  const [activeInteraction, setActiveInteraction] = useState<CampaignSponsorInteraction | null>(null);
  const [isInteractionModalOpen, setIsInteractionModalOpen] = useState(false);
  const [isDetailsSectionOpen, setIsDetailsSectionOpen] = useState(true);
  const [isParticipationSectionOpen, setIsParticipationSectionOpen] = useState(true);
  const [isSponsoredGiftsSectionOpen, setIsSponsoredGiftsSectionOpen] = useState(true);
  const [isCommunicationSectionOpen, setIsCommunicationSectionOpen] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [communicationPreview, setCommunicationPreview] = useState<SponsorCommunicationPreview | null>(null);
  const [communicationError, setCommunicationError] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isSendingCommunication, setIsSendingCommunication] = useState(false);

  useEffect(() => {
    if (!sponsor) {
      setForm(createEmptySponsorForm());
      setParticipation(createEmptyParticipationForm());
      setIsDetailsSectionOpen(true);
      setIsParticipationSectionOpen(true);
      setIsSponsoredGiftsSectionOpen(false);
      setIsCommunicationSectionOpen(false);
    } else {
      setForm({
        firstName: sponsor.firstName,
        lastName: sponsor.lastName,
        displayName: sponsor.displayName,
        organizationName: sponsor.organizationName,
        email: sponsor.email,
        phone: sponsor.phone,
        addressLine1: sponsor.addressLine1,
        addressLine2: sponsor.addressLine2,
        city: sponsor.city,
        state: sponsor.state,
        postalCode: sponsor.postalCode,
        preferredContact: sponsor.preferredContact,
        source: sponsor.source,
        sourceDetail: sponsor.sourceDetail,
        notes: sponsor.notes,
        isActive: sponsor.isActive,
        doNotContact: sponsor.doNotContact,
      });
      setParticipation({
        status: sponsor.participation.status,
        interestStatus: sponsor.participation.interestStatus,
        dropOffStatus: sponsor.participation.dropOffStatus,
        dropOffDueAt: sponsor.participation.dropOffDueAt,
        dropOffCompletedAt: sponsor.participation.dropOffCompletedAt,
        selfRegistered: sponsor.participation.selfRegistered,
        sponsorCode: sponsor.participation.sponsorCode,
        notes: sponsor.participation.notes,
      });
      setIsDetailsSectionOpen(false);
      setIsParticipationSectionOpen(false);
      setIsSponsoredGiftsSectionOpen(true);
      setIsCommunicationSectionOpen(true);
    }
    setLocalError(null);
    setLocalSuccess(null);
    setCommunicationPreview(null);
    setCommunicationError(null);
    setSelectedTemplateId('');
  }, [sponsor]);

  useEffect(() => {
    if (isOpen && sponsor?.id && !interactionsState?.loaded && !interactionsState?.isLoading) {
      void onLoadInteractions(sponsor.id);
    }
  }, [interactionsState?.isLoading, interactionsState?.loaded, isOpen, onLoadInteractions, sponsor?.id]);

  const derivedDisplayName = useMemo(() => {
    const explicit = (form.displayName ?? '').trim();
    if (explicit) {
      return explicit;
    }
    const first = (form.firstName ?? '').trim();
    const last = (form.lastName ?? '').trim();
    if (first && last) {
      return `${first} ${last}`;
    }
    return (form.organizationName ?? '').trim() || (form.email ?? '').trim() || 'Sponsor';
  }, [form.displayName, form.email, form.firstName, form.lastName, form.organizationName]);

  const deleteDetails = useMemo(() => {
    if (!sponsor) {
      return [];
    }
    return [
      sponsor.participation.sponsorCode ? `Sponsor code: ${sponsor.participation.sponsorCode}` : 'Campaign sponsor record',
      `${sponsor.sponsoredItems.length} sponsored gift${sponsor.sponsoredItems.length === 1 ? '' : 's'}`,
      `${(interactionsState?.items.length ?? sponsor.interactionCount)} communication log entr${(interactionsState?.items.length ?? sponsor.interactionCount) === 1 ? 'y' : 'ies'}`,
    ];
  }, [interactionsState?.items.length, sponsor]);

  const title = sponsor ? 'Sponsor Details' : 'Add Sponsor';
  const description = sponsor
    ? 'Update the sponsor identity, campaign participation, sponsored gifts, and communication history.'
    : 'Create a sponsor record for this campaign and keep the participation details in one place.';

  const handleSave = async () => {
    setLocalError(null);
    setLocalSuccess(null);
    try {
      const saved = await onSaveSponsor(form, participation, sponsor?.id);
      if (saved) {
        onSaved(saved);
        setLocalSuccess(sponsor ? 'Sponsor updated.' : 'Sponsor added.');
      }
    } catch (saveError) {
      setLocalError(saveError instanceof Error ? saveError.message : 'Unable to save sponsor.');
    }
  };

  const handleDelete = async () => {
    if (!sponsor) {
      return;
    }
    setIsDeleteSubmitting(true);
    try {
      const deleted = await onDeleteSponsor(sponsor.id);
      if (deleted) {
        setIsDeleteConfirmOpen(false);
        onClose();
      }
    } finally {
      setIsDeleteSubmitting(false);
    }
  };

  const interactionItems = interactionsState?.items ?? sponsor?.recentInteractions ?? [];
  const latestInteraction = getMostRecentSponsorInteraction(interactionItems);
  const sponsorEmailTemplates = useMemo(
    () => communicationTemplates.filter((template) => template.audience === 'SPONSOR' && template.channel === 'EMAIL' && template.isActive),
    [communicationTemplates]
  );
  const selectedTemplate = sponsorEmailTemplates.find((template) => template.id === selectedTemplateId) ?? null;
  const hasCurrentPreview = communicationPreview?.templateId === selectedTemplateId;

  const handlePreviewCommunication = async () => {
    if (!sponsor || !selectedTemplateId) {
      return;
    }
    setCommunicationError(null);
    setCommunicationPreview(null);
    setIsPreviewLoading(true);
    try {
      const preview = await onPreviewCommunication(sponsor.id, selectedTemplateId);
      setCommunicationPreview(preview);
    } catch (previewError) {
      setCommunicationError(previewError instanceof Error ? previewError.message : 'Unable to preview sponsor email.');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleSendCommunication = async () => {
    if (!sponsor || !selectedTemplateId) {
      return;
    }
    setCommunicationError(null);
    setIsSendingCommunication(true);
    try {
      await onSendCommunication(sponsor.id, selectedTemplateId);
      setLocalSuccess('Sponsor email sent.');
      setCommunicationPreview(null);
    } catch (sendError) {
      setCommunicationError(sendError instanceof Error ? sendError.message : 'Unable to send sponsor email.');
    } finally {
      setIsSendingCommunication(false);
    }
  };

  return (
    <>
      <CampaignStudioDrawer
        isOpen={isOpen}
        title={title}
        description={description}
        onClose={onClose}
        width="xwide"
      >
        <div className="campaign-page-stack">
          {localError ? <div className="alert alert-danger mb-0">{localError}</div> : null}
          {localSuccess ? <div className="alert alert-success mb-0">{localSuccess}</div> : null}

          <CollapsibleSponsorSection
            title="Sponsor Details"
            description="Standardize the sponsor identity and preferred contact information for future campaigns."
            isOpen={isDetailsSectionOpen}
            onToggle={() => setIsDetailsSectionOpen((currentValue) => !currentValue)}
            summary={
              <SponsorSummaryChips
                items={[
                  ['bi-person-vcard', derivedDisplayName],
                  ['bi-chat-dots', toSponsorPreferredContactLabel(form.preferredContact)],
                  ['bi-telephone', form.email ?? form.phone ?? 'No contact details'],
                  ['bi-calendar2-check', `Last contacted ${formatShortDate(sponsor?.lastContactedAt ?? null)}`],
                ]}
              />
            }
          >

            <div className="campaign-sponsor-drawer__summary">
              <span className="campaign-chip campaign-chip-muted">
                <i className="bi bi-person-vcard" aria-hidden="true" />
                <span>{derivedDisplayName}</span>
              </span>
              <span className="campaign-chip campaign-chip-muted">
                <i className="bi bi-chat-dots" aria-hidden="true" />
                <span>{toSponsorPreferredContactLabel(form.preferredContact)}</span>
              </span>
              <span className="campaign-chip campaign-chip-muted">
                <i className="bi bi-hourglass-split" aria-hidden="true" />
                <span>{toSponsorStatusLabel(participation.status)}</span>
              </span>
            </div>

            <div className="row g-3">
              <div className="col-md-6">
                <SponsorFieldLabel campaignId={campaignId} fieldName="Display Name" fieldLabel="First Name">
                  First Name
                </SponsorFieldLabel>
                <input
                  className="form-control"
                  value={form.firstName ?? ''}
                  onChange={(event) => setForm((currentValue) => ({ ...currentValue, firstName: event.target.value || null }))}
                  disabled={!canEdit}
                />
              </div>
              <div className="col-md-6">
                <SponsorFieldLabel campaignId={campaignId} fieldName="Display Name" fieldLabel="Last Name">
                  Last Name
                </SponsorFieldLabel>
                <input
                  className="form-control"
                  value={form.lastName ?? ''}
                  onChange={(event) => setForm((currentValue) => ({ ...currentValue, lastName: event.target.value || null }))}
                  disabled={!canEdit}
                />
              </div>
              <div className="col-md-6">
                <SponsorFieldLabel campaignId={campaignId} fieldName="Organization">
                  Organization Name
                </SponsorFieldLabel>
                <input
                  className="form-control"
                  value={form.organizationName ?? ''}
                  onChange={(event) => setForm((currentValue) => ({ ...currentValue, organizationName: event.target.value || null }))}
                  disabled={!canEdit}
                />
              </div>
              <div className="col-md-6">
                <SponsorFieldLabel campaignId={campaignId} fieldName="Display Name">
                  Display Name
                </SponsorFieldLabel>
                <input
                  className="form-control"
                  value={form.displayName ?? ''}
                  onChange={(event) => setForm((currentValue) => ({ ...currentValue, displayName: event.target.value || null }))}
                  placeholder={derivedDisplayName}
                  disabled={!canEdit}
                />
              </div>
              <div className="col-md-6">
                <SponsorFieldLabel campaignId={campaignId} fieldName="Email">
                  Email
                </SponsorFieldLabel>
                <input
                  className="form-control"
                  type="email"
                  value={form.email ?? ''}
                  onChange={(event) => setForm((currentValue) => ({ ...currentValue, email: event.target.value || null }))}
                  disabled={!canEdit}
                />
              </div>
              <div className="col-md-6">
                <SponsorFieldLabel campaignId={campaignId} fieldName="Phone">
                  Phone
                </SponsorFieldLabel>
                <input
                  className="form-control"
                  value={form.phone ?? ''}
                  onChange={(event) => setForm((currentValue) => ({ ...currentValue, phone: event.target.value || null }))}
                  disabled={!canEdit}
                />
              </div>
              <div className="col-md-4">
                <SponsorFieldLabel campaignId={campaignId} fieldName="Preferred Contact">
                  Preferred Contact
                </SponsorFieldLabel>
                <select
                  className="form-select"
                  value={form.preferredContact}
                  onChange={(event) =>
                    setForm((currentValue) => ({
                      ...currentValue,
                      preferredContact: event.target.value as SponsorPreferredContact,
                    }))
                  }
                  disabled={!canEdit}
                >
                  <option value="EMAIL">Email</option>
                  <option value="PHONE">Phone</option>
                  <option value="TEXT">Text</option>
                  <option value="NONE">None</option>
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Source</label>
                <select
                  className="form-select"
                  value={form.source}
                  onChange={(event) => setForm((currentValue) => ({ ...currentValue, source: event.target.value as SponsorUpsertInput['source'] }))}
                  disabled={!canEdit}
                >
                  <option value="STAFF_ENTRY">Staff Entry</option>
                  <option value="PUBLIC_QR">Public QR</option>
                  <option value="PUBLIC_LINK">Public Link</option>
                  <option value="IMPORT">Import</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Source Detail</label>
                <input
                  className="form-control"
                  value={form.sourceDetail ?? ''}
                  onChange={(event) => setForm((currentValue) => ({ ...currentValue, sourceDetail: event.target.value || null }))}
                  disabled={!canEdit}
                />
              </div>
              <div className="col-md-6">
                <SponsorFieldLabel campaignId={campaignId} fieldName="Address Fields" fieldLabel="Address Line 1">
                  Address Line 1
                </SponsorFieldLabel>
                <input
                  className="form-control"
                  value={form.addressLine1 ?? ''}
                  onChange={(event) => setForm((currentValue) => ({ ...currentValue, addressLine1: event.target.value || null }))}
                  disabled={!canEdit}
                />
              </div>
              <div className="col-md-6">
                <SponsorFieldLabel campaignId={campaignId} fieldName="Address Fields" fieldLabel="Address Line 2">
                  Address Line 2
                </SponsorFieldLabel>
                <input
                  className="form-control"
                  value={form.addressLine2 ?? ''}
                  onChange={(event) => setForm((currentValue) => ({ ...currentValue, addressLine2: event.target.value || null }))}
                  disabled={!canEdit}
                />
              </div>
              <div className="col-md-5">
                <SponsorFieldLabel campaignId={campaignId} fieldName="Address Fields" fieldLabel="City">
                  City
                </SponsorFieldLabel>
                <input
                  className="form-control"
                  value={form.city ?? ''}
                  onChange={(event) => setForm((currentValue) => ({ ...currentValue, city: event.target.value || null }))}
                  disabled={!canEdit}
                />
              </div>
              <div className="col-md-3">
                <SponsorFieldLabel campaignId={campaignId} fieldName="Address Fields" fieldLabel="State">
                  State
                </SponsorFieldLabel>
                <input
                  className="form-control"
                  value={form.state ?? ''}
                  onChange={(event) => setForm((currentValue) => ({ ...currentValue, state: event.target.value || null }))}
                  disabled={!canEdit}
                />
              </div>
              <div className="col-md-4">
                <SponsorFieldLabel campaignId={campaignId} fieldName="Address Fields" fieldLabel="Postal Code">
                  Postal Code
                </SponsorFieldLabel>
                <input
                  className="form-control"
                  value={form.postalCode ?? ''}
                  onChange={(event) => setForm((currentValue) => ({ ...currentValue, postalCode: event.target.value || null }))}
                  disabled={!canEdit}
                />
              </div>
              <div className="col-12">
                <SponsorFieldLabel campaignId={campaignId} fieldName="Notes">
                  Notes
                </SponsorFieldLabel>
                <textarea
                  className="form-control"
                  rows={3}
                  value={form.notes ?? ''}
                  onChange={(event) => setForm((currentValue) => ({ ...currentValue, notes: event.target.value || null }))}
                  disabled={!canEdit}
                />
              </div>
              <div className="col-md-6">
                <label className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(event) => setForm((currentValue) => ({ ...currentValue, isActive: event.target.checked }))}
                    disabled={!canEdit}
                  />
                  <span className="form-check-label d-inline-flex align-items-center gap-1">
                    <span>Sponsor is active</span>
                    <FieldHelpButton campaignId={campaignId} screen="Sponsor Drawer" fieldName="Sponsor is Active" />
                  </span>
                </label>
              </div>
              <div className="col-md-6">
                <label className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={form.doNotContact}
                    onChange={(event) => setForm((currentValue) => ({ ...currentValue, doNotContact: event.target.checked }))}
                    disabled={!canEdit}
                  />
                  <span className="form-check-label d-inline-flex align-items-center gap-1">
                    <span>Do not contact</span>
                    <FieldHelpButton campaignId={campaignId} screen="Sponsor Drawer" fieldName="Do Not Contact" />
                  </span>
                </label>
              </div>
            </div>
          </CollapsibleSponsorSection>

          <CollapsibleSponsorSection
            title="Campaign Participation"
            description="Track this sponsor’s campaign-specific commitment, gift drop-off progress, and sponsor code."
            isOpen={isParticipationSectionOpen}
            onToggle={() => setIsParticipationSectionOpen((currentValue) => !currentValue)}
            summary={
              <SponsorSummaryChips
                items={[
                  ['bi-hourglass-split', toSponsorStatusLabel(participation.status)],
                  ['bi-person-check', participation.interestStatus],
                  ['bi-box-seam', participation.dropOffStatus],
                  ['bi-upc-scan', participation.sponsorCode ?? 'No sponsor code'],
                ]}
              />
            }
          >

            <div className="row g-3">
              <div className="col-md-3">
                <SponsorFieldLabel campaignId={campaignId} fieldName="Campaign Participation Status" fieldLabel="Status">
                  Status
                </SponsorFieldLabel>
                <select
                  className="form-select"
                  value={participation.status}
                  onChange={(event) =>
                    setParticipation((currentValue) => ({
                      ...currentValue,
                      status: event.target.value as SponsorshipUpsertInput['status'],
                    }))
                  }
                  disabled={!canEdit}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="COMPLETE">Complete</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
              <div className="col-md-3">
                <SponsorFieldLabel campaignId={campaignId} fieldName="Interest">
                  Interest
                </SponsorFieldLabel>
                <select
                  className="form-select"
                  value={participation.interestStatus}
                  onChange={(event) =>
                    setParticipation((currentValue) => ({
                      ...currentValue,
                      interestStatus: event.target.value as SponsorshipUpsertInput['interestStatus'],
                    }))
                  }
                  disabled={!canEdit}
                >
                  <option value="NEW">New</option>
                  <option value="CONTACTED">Contacted</option>
                  <option value="RESPONDED">Responded</option>
                  <option value="COMMITTED">Committed</option>
                  <option value="DECLINED">Declined</option>
                </select>
              </div>
              <div className="col-md-3">
                <SponsorFieldLabel campaignId={campaignId} fieldName="Drop-off">
                  Drop-off
                </SponsorFieldLabel>
                <select
                  className="form-select"
                  value={participation.dropOffStatus}
                  onChange={(event) =>
                    setParticipation((currentValue) => ({
                      ...currentValue,
                      dropOffStatus: event.target.value as SponsorshipUpsertInput['dropOffStatus'],
                    }))
                  }
                  disabled={!canEdit}
                >
                  <option value="NOT_STARTED">Not Started</option>
                  <option value="SCHEDULED">Scheduled</option>
                  <option value="RECEIVED">Received</option>
                  <option value="LATE">Late</option>
                </select>
              </div>
              <div className="col-md-3">
                <SponsorFieldLabel campaignId={campaignId} fieldName="Sponsor Code">
                  Sponsor Code
                </SponsorFieldLabel>
                <input
                  className="form-control"
                  value={participation.sponsorCode ?? ''}
                  onChange={(event) =>
                    setParticipation((currentValue) => ({
                      ...currentValue,
                      sponsorCode: event.target.value || null,
                    }))
                  }
                  disabled={!canEdit}
                />
              </div>
              <div className="col-md-6">
                <SponsorFieldLabel campaignId={campaignId} fieldName="Drop-off Due">
                  Drop-off Due
                </SponsorFieldLabel>
                <input
                  className="form-control"
                  type="datetime-local"
                  value={toDateTimeInputValue(participation.dropOffDueAt)}
                  onChange={(event) =>
                    setParticipation((currentValue) => ({
                      ...currentValue,
                      dropOffDueAt: fromDateTimeInputValue(event.target.value),
                    }))
                  }
                  disabled={!canEdit}
                />
              </div>
              <div className="col-md-6">
                <SponsorFieldLabel campaignId={campaignId} fieldName="Drop-off Completed">
                  Drop-off Completed
                </SponsorFieldLabel>
                <input
                  className="form-control"
                  type="datetime-local"
                  value={toDateTimeInputValue(participation.dropOffCompletedAt)}
                  onChange={(event) =>
                    setParticipation((currentValue) => ({
                      ...currentValue,
                      dropOffCompletedAt: fromDateTimeInputValue(event.target.value),
                    }))
                  }
                  disabled={!canEdit}
                />
              </div>
              <div className="col-12">
                <SponsorFieldLabel campaignId={campaignId} fieldName="Campaign Notes">
                  Campaign Notes
                </SponsorFieldLabel>
                <textarea
                  className="form-control"
                  rows={3}
                  value={participation.notes ?? ''}
                  onChange={(event) => setParticipation((currentValue) => ({ ...currentValue, notes: event.target.value || null }))}
                  disabled={!canEdit}
                />
              </div>
            </div>
          </CollapsibleSponsorSection>

          <CollapsibleSponsorSection
            title="Sponsored Gifts"
            description="Review the gifts currently linked to this sponsor for the active campaign."
            isOpen={isSponsoredGiftsSectionOpen}
            onToggle={() => setIsSponsoredGiftsSectionOpen((currentValue) => !currentValue)}
            summary={
              <SponsorSummaryChips
                items={[
                  ['bi-gift', sponsor ? `${sponsor.sponsoredItems.length} linked gift${sponsor.sponsoredItems.length === 1 ? '' : 's'}` : 'Save sponsor first'],
                  ['bi-person-hearts', sponsor?.sponsoredItems[0]?.recipient?.displayLabel ?? 'No linked recipient'],
                  ['bi-box-seam', sponsor?.sponsoredItems[0]?.gift?.description ?? 'No linked gift'],
                ]}
              />
            }
          >

            {!sponsor ? (
              <div className="campaign-studio__empty-note">Save the sponsor first to start linking gifts and tracking commitments.</div>
            ) : sponsor.sponsoredItems.length === 0 ? (
              <div className="campaign-studio__empty-note">No gifts are linked to this sponsor yet.</div>
            ) : (
              <div className="table-responsive">
                <table className="table campaign-team-table align-middle">
                  <thead>
                    <tr>
                      <th scope="col">Recipient</th>
                      <th scope="col">Gift</th>
                      <th scope="col">Qty</th>
                      <th scope="col">Status</th>
                      <th scope="col">Committed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sponsor.sponsoredItems.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="campaign-sponsor-table__primary">
                            <span>{item.recipient?.displayLabel ?? 'Unknown recipient'}</span>
                            <span className="campaign-sponsor-table__meta">{item.recipient?.programRecipientId ?? 'No person ID'}</span>
                          </div>
                        </td>
                        <td>
                          <div className="campaign-sponsor-table__primary">
                            <span>{item.gift?.description ?? 'Unknown gift'}</span>
                            <span className="campaign-sponsor-table__meta">
                              {[item.gift?.category, item.gift?.size].filter(Boolean).join(' · ') || 'No additional details'}
                            </span>
                          </div>
                        </td>
                        <td>{item.qtyCommitted}</td>
                        <td>{item.gift?.status ?? 'Not set'}</td>
                        <td>{formatShortDate(item.committedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CollapsibleSponsorSection>

          <CollapsibleSponsorSection
            title="Communication Log"
            description="Record manual outreach and review system-generated campaign communications for this sponsor."
            isOpen={isCommunicationSectionOpen}
            onToggle={() => setIsCommunicationSectionOpen((currentValue) => !currentValue)}
            action={
              canEdit && sponsor ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm campaign-team-workspace__section-action"
                  onClick={() => {
                    setActiveInteraction(null);
                    setIsInteractionModalOpen(true);
                  }}
                >
                  <i className="bi bi-chat-square-dots" aria-hidden="true" />
                  <span>Add Interaction</span>
                </button>
              ) : null
            }
            summary={
              <SponsorSummaryChips
                items={[
                  ['bi-calendar2-check', `Last contacted ${formatShortDate(sponsor?.lastContactedAt ?? null)}`],
                  ['bi-chat-left-text', summarizeSponsorInteraction(latestInteraction)],
                  ['bi-bell', summarizeFollowUp(interactionItems)],
                ]}
              />
            }
          >

            {sponsor && canEdit ? (
              <div className="campaign-sponsor-communication-send">
                <div className="campaign-sponsor-communication-send__header">
                  <div>
                    <h3 className="h6 mb-1">Send Sponsor Email</h3>
                    <p className="text-muted mb-0">
                      Send an active sponsor email template with this sponsor’s committed gift details merged in.
                    </p>
                  </div>
                  <span className="campaign-chip campaign-chip-muted">
                    <i className="bi bi-envelope-paper" aria-hidden="true" />
                    <span>{sponsor.email ?? 'No email'}</span>
                  </span>
                </div>

                {communicationTemplateError ? (
                  <div className="alert alert-warning mb-0">{communicationTemplateError}</div>
                ) : null}
                {communicationError ? <div className="alert alert-danger mb-0">{communicationError}</div> : null}

                <div className="row g-3 align-items-end">
                  <div className="col-12 col-lg-7">
                    <SponsorFieldLabel campaignId={campaignId} fieldName="Template">
                      Template
                    </SponsorFieldLabel>
                    <select
                      className="form-select"
                      value={selectedTemplateId}
                      onChange={(event) => {
                        setSelectedTemplateId(event.target.value);
                        setCommunicationPreview(null);
                        setCommunicationError(null);
                      }}
                    >
                      <option value="">Choose an active sponsor template</option>
                      {sponsorEmailTemplates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12 col-lg-5">
                    <div className="campaign-sponsor-communication-send__actions">
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        disabled={!selectedTemplateId || isPreviewLoading || isSendingCommunication}
                        onClick={() => void handlePreviewCommunication()}
                      >
                        <i className={`bi ${isPreviewLoading ? 'bi-arrow-repeat' : 'bi-eye'} me-2`} aria-hidden="true" />
                        Preview
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={!hasCurrentPreview || isPreviewLoading || isSendingCommunication}
                        onClick={() => void handleSendCommunication()}
                      >
                        <i className={`bi ${isSendingCommunication ? 'bi-arrow-repeat' : 'bi-send'} me-2`} aria-hidden="true" />
                        Send Email
                      </button>
                    </div>
                  </div>
                </div>

                {sponsorEmailTemplates.length === 0 ? (
                  <div className="campaign-studio__empty-note mb-0">
                    No active sponsor email templates are available. Create one in Campaign Studio Communications.
                  </div>
                ) : null}

                {communicationPreview ? (
                  <div className="campaign-sponsor-communication-preview">
                    {communicationPreview.warnings.length > 0 ? (
                      <div className="campaign-sponsor-communication-preview__warnings">
                        {communicationPreview.warnings.map((warning) => (
                          <div key={warning.code} className="alert alert-warning py-2 mb-0">
                            <i className="bi bi-exclamation-triangle me-2" aria-hidden="true" />
                            {warning.message}
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <div className="campaign-sponsor-communication-preview__meta">
                      <div>
                        <span className="small text-uppercase text-muted fw-semibold">To</span>
                        <div>{communicationPreview.recipientEmail}</div>
                      </div>
                      <div>
                        <span className="small text-uppercase text-muted fw-semibold">Subject</span>
                        <div>{communicationPreview.subject}</div>
                      </div>
                    </div>

                    <iframe
                      className="campaign-sponsor-communication-preview__frame"
                      title={selectedTemplate ? `${selectedTemplate.name} preview` : 'Sponsor email preview'}
                      srcDoc={communicationPreview.html}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            {!sponsor ? (
              <div className="campaign-studio__empty-note">Save the sponsor first to manage the communication log.</div>
            ) : interactionsState?.isLoading ? (
              <div className="campaign-studio__empty-note">Loading communication log...</div>
            ) : interactionsState?.error ? (
              <div className="alert alert-warning mb-0">{interactionsState.error}</div>
            ) : interactionItems.length === 0 ? (
              <div className="campaign-studio__empty-note">No communication history has been recorded for this sponsor yet.</div>
            ) : (
              <>
                <div className="campaign-sponsor-drawer__summary">
                  <span className="campaign-chip campaign-chip-muted">
                    <i className="bi bi-chat-left-text" aria-hidden="true" />
                    <span>{interactionItems.length} interaction{interactionItems.length === 1 ? '' : 's'}</span>
                  </span>
                  <span className="campaign-chip campaign-chip-muted">
                    <i className="bi bi-clock-history" aria-hidden="true" />
                    <span>{summarizeSponsorInteraction(latestInteraction)}</span>
                  </span>
                  <span className="campaign-chip campaign-chip-muted">
                    <i className="bi bi-calendar2-check" aria-hidden="true" />
                    <span>{summarizeFollowUp(interactionItems)}</span>
                  </span>
                </div>
                <div className="table-responsive">
                  <table className="table campaign-team-table align-middle">
                    <thead>
                      <tr>
                        <th scope="col">When</th>
                        <th scope="col">Channel</th>
                        <th scope="col">Subject</th>
                        <th scope="col">Outcome</th>
                        <th scope="col">Origin</th>
                        {canEdit ? <th scope="col" className="text-end">Actions</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {interactionItems.map((interaction) => {
                        const isManual = interaction.originType === 'MANUAL';
                        return (
                          <tr key={interaction.id}>
                            <td>{formatSponsorDateTime(interaction.occurredAt)}</td>
                            <td>{interaction.channel}</td>
                            <td>
                              <div className="campaign-sponsor-table__primary">
                                <span>{interaction.subject ?? 'No subject'}</span>
                                <span className="campaign-sponsor-table__meta">
                                  {interaction.notes ? truncate(interaction.notes, 80) : 'No notes'}
                                </span>
                              </div>
                            </td>
                            <td>{interaction.outcome}</td>
                            <td>{toSponsorInteractionOriginLabel(interaction.originType)}</td>
                            {canEdit ? (
                              <td className="text-end">
                                {isManual ? (
                                  <div className="d-inline-flex gap-2">
                                    <button
                                      type="button"
                                      className="btn btn-outline-secondary btn-sm"
                                      onClick={() => {
                                        setActiveInteraction(interaction);
                                        setIsInteractionModalOpen(true);
                                      }}
                                    >
                                      <i className="bi bi-pencil-square" aria-hidden="true" />
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-outline-danger btn-sm"
                                      onClick={async () => {
                                        setLocalError(null);
                                        setLocalSuccess(null);
                                        try {
                                          await onDeleteInteraction(sponsor.id, interaction.id);
                                          setLocalSuccess('Interaction removed.');
                                        } catch (deleteError) {
                                          setLocalError(deleteError instanceof Error ? deleteError.message : 'Unable to remove interaction.');
                                        }
                                      }}
                                    >
                                      <i className="bi bi-trash3" aria-hidden="true" />
                                    </button>
                                  </div>
                                ) : (
                                  <span className="campaign-chip campaign-chip-muted">
                                    <i className="bi bi-lock" aria-hidden="true" />
                                    <span>Read only</span>
                                  </span>
                                )}
                              </td>
                            ) : null}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CollapsibleSponsorSection>

          <details className="campaign-people-metadata-details">
            <summary className="campaign-people-metadata-details__summary">
              <i className="bi bi-info-circle" aria-hidden="true" />
              <span>Metadata</span>
            </summary>
            <div className="campaign-people-drawer__meta">
              <MetadataRow label="Last Contacted" value={formatShortDate(sponsor?.lastContactedAt ?? null)} />
              <MetadataRow label="Self Registered" value={sponsor?.selfRegisteredAt ? formatShortDate(sponsor.selfRegisteredAt) : 'No'} />
              <MetadataRow label="Created" value={formatShortDate(sponsor?.createdAt ?? null)} />
              <MetadataRow label="Updated" value={formatShortDate(sponsor?.updatedAt ?? null)} />
            </div>
          </details>

          <div className="campaign-team-drawer__actions">
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose}>
              <i className="bi bi-x-circle me-2" aria-hidden="true" />
              Close
            </button>
            {sponsor && canEdit ? (
              <button
                type="button"
                className="btn btn-outline-danger btn-sm"
                onClick={() => setIsDeleteConfirmOpen(true)}
              >
                <i className="bi bi-trash3 me-2" aria-hidden="true" />
                Delete Sponsor
              </button>
            ) : null}
            {canEdit ? (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void handleSave()} disabled={isSaving}>
                <i className={`bi ${isSaving ? 'bi-arrow-repeat' : 'bi-floppy'} me-2`} aria-hidden="true" />
                {sponsor ? 'Save Sponsor' : 'Add Sponsor'}
              </button>
            ) : null}
          </div>
        </div>
      </CampaignStudioDrawer>

      <ConfirmationModal
        open={isDeleteConfirmOpen}
        title={sponsor ? `Delete ${sponsor.displayName}?` : 'Delete sponsor?'}
        message="This will remove the sponsor from the current campaign and may remove the global sponsor record if it is not used anywhere else."
        details={deleteDetails}
        confirmLabel="Delete Sponsor"
        isSubmitting={isDeleteSubmitting}
        onConfirm={handleDelete}
        onClose={() => setIsDeleteConfirmOpen(false)}
      />

      {isInteractionModalOpen ? (
        <SponsorInteractionModal
          key={activeInteraction?.id ?? 'new-interaction'}
          campaignId={campaignId}
          sponsor={sponsor}
          interaction={activeInteraction}
          isSaving={isSaving}
          onClose={() => setIsInteractionModalOpen(false)}
          onSave={async (input) => {
            if (!sponsor) {
              return;
            }
            setLocalError(null);
            setLocalSuccess(null);
            try {
              await onSaveInteraction(sponsor.id, input, activeInteraction?.id);
              setLocalSuccess(activeInteraction ? 'Interaction updated.' : 'Interaction added.');
              setIsInteractionModalOpen(false);
            } catch (saveError) {
              setLocalError(saveError instanceof Error ? saveError.message : 'Unable to save interaction.');
            }
          }}
        />
      ) : null}
    </>
  );
}

function CollapsibleSponsorSection({
  title,
  description,
  isOpen,
  onToggle,
  action,
  summary,
  children,
}: {
  title: string;
  description: string;
  isOpen: boolean;
  onToggle: () => void;
  action?: ReactNode;
  summary?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="campaign-team-workspace__section">
      <div className="campaign-team-workspace__section-header">
        <div className="campaign-sponsor-section-heading">
          <button
            type="button"
            className="campaign-sponsor-section-heading__toggle"
            onClick={onToggle}
            aria-expanded={isOpen}
            aria-label={isOpen ? `Collapse ${title}` : `Expand ${title}`}
          >
            <i className={`bi ${isOpen ? 'bi-chevron-down' : 'bi-chevron-right'}`} aria-hidden="true" />
          </button>
          <div>
            <h2 className="h5 mb-1">{title}</h2>
            <p className="text-muted mb-0">{description}</p>
          </div>
        </div>
        {action}
      </div>

      {isOpen ? children : summary ? <div className="campaign-sponsor-section-summary">{summary}</div> : null}
    </section>
  );
}

function SponsorSummaryChips({ items }: { items: Array<[string, string]> }) {
  return (
    <div className="campaign-sponsor-drawer__summary">
      {items.map(([icon, label]) => (
        <span key={`${icon}:${label}`} className="campaign-chip campaign-chip-muted">
          <i className={`bi ${icon}`} aria-hidden="true" />
          <span>{label}</span>
        </span>
      ))}
    </div>
  );
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="small text-uppercase text-muted fw-semibold">{label}</div>
      <div>{value}</div>
    </div>
  );
}

function SponsorFieldLabel({
  campaignId,
  screen = 'Sponsor Drawer',
  fieldName,
  fieldLabel,
  children,
}: {
  campaignId?: string | null;
  screen?: string;
  fieldName: string;
  fieldLabel?: string;
  children: ReactNode;
}) {
  return (
    <label className="form-label d-flex align-items-center gap-1">
      <span>{children}</span>
      <FieldHelpButton campaignId={campaignId} screen={screen} fieldName={fieldName} fieldLabel={fieldLabel} />
    </label>
  );
}

function SponsorInteractionModal({
  campaignId,
  sponsor,
  interaction,
  isSaving,
  onClose,
  onSave,
}: {
  campaignId?: string | null;
  sponsor: CampaignSponsor | null;
  interaction: CampaignSponsorInteraction | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (input: SponsorInteractionUpsertInput) => Promise<void>;
}) {
  const [form, setForm] = useState<SponsorInteractionUpsertInput>(() =>
    interaction
      ? {
          channel: interaction.channel,
          direction: interaction.direction,
          subject: interaction.subject,
          outcome: interaction.outcome,
          notes: interaction.notes,
          occurredAt: interaction.occurredAt,
          followUpAt: interaction.followUpAt,
        }
      : createEmptyInteractionForm()
  );

  if (!sponsor) {
    return null;
  }

  return (
    <div className="campaign-sponsor-modal__backdrop" role="presentation" onClick={onClose}>
      <div className="campaign-sponsor-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="campaign-sponsor-modal__header">
          <div>
            <h3 className="h5 mb-1">{interaction ? 'Edit Interaction' : 'Add Interaction'}</h3>
            <p className="text-muted mb-0">{sponsor.displayName}</p>
          </div>
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose}>
            <i className="bi bi-x-lg me-2" aria-hidden="true" />
            Close
          </button>
        </div>

        <div className="row g-3">
          <div className="col-md-4">
            <SponsorFieldLabel campaignId={campaignId} screen="Sponsor Interaction" fieldName="Channel">
              Channel
            </SponsorFieldLabel>
            <select
              className="form-select"
              value={form.channel}
              onChange={(event) => setForm((currentValue) => ({ ...currentValue, channel: event.target.value as SponsorInteractionUpsertInput['channel'] }))}
            >
              <option value="CALL">Call</option>
              <option value="EMAIL">Email</option>
              <option value="TEXT">Text</option>
              <option value="IN_PERSON">In Person</option>
            </select>
          </div>
          <div className="col-md-4">
            <SponsorFieldLabel campaignId={campaignId} screen="Sponsor Interaction" fieldName="Direction">
              Direction
            </SponsorFieldLabel>
            <select
              className="form-select"
              value={form.direction}
              onChange={(event) => setForm((currentValue) => ({ ...currentValue, direction: event.target.value as SponsorInteractionUpsertInput['direction'] }))}
            >
              <option value="OUTBOUND">Outbound</option>
              <option value="INBOUND">Inbound</option>
            </select>
          </div>
          <div className="col-md-4">
            <SponsorFieldLabel campaignId={campaignId} screen="Sponsor Interaction" fieldName="Outcome">
              Outcome
            </SponsorFieldLabel>
            <select
              className="form-select"
              value={form.outcome}
              onChange={(event) => setForm((currentValue) => ({ ...currentValue, outcome: event.target.value as SponsorInteractionUpsertInput['outcome'] }))}
            >
              <option value="LEFT_VM">Left Voicemail</option>
              <option value="NO_ANSWER">No Answer</option>
              <option value="REACHED">Reached</option>
              <option value="BOUNCED">Bounced</option>
              <option value="WRONG_NUMBER">Wrong Number</option>
              <option value="PROMISED_DATE">Promised Date</option>
              <option value="COMPLETED">Completed</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div className="col-12">
            <SponsorFieldLabel campaignId={campaignId} screen="Sponsor Interaction" fieldName="Subject">
              Subject
            </SponsorFieldLabel>
            <input
              className="form-control"
              value={form.subject ?? ''}
              onChange={(event) => setForm((currentValue) => ({ ...currentValue, subject: event.target.value || null }))}
            />
          </div>
          <div className="col-md-6">
            <SponsorFieldLabel campaignId={campaignId} screen="Sponsor Interaction" fieldName="Occurred At">
              Occurred At
            </SponsorFieldLabel>
            <input
              className="form-control"
              type="datetime-local"
              value={toDateTimeInputValue(form.occurredAt)}
              onChange={(event) => setForm((currentValue) => ({ ...currentValue, occurredAt: fromDateTimeInputValue(event.target.value) }))}
            />
          </div>
          <div className="col-md-6">
            <SponsorFieldLabel campaignId={campaignId} screen="Sponsor Interaction" fieldName="Follow-up At">
              Follow-up At
            </SponsorFieldLabel>
            <input
              className="form-control"
              type="datetime-local"
              value={toDateTimeInputValue(form.followUpAt)}
              onChange={(event) => setForm((currentValue) => ({ ...currentValue, followUpAt: fromDateTimeInputValue(event.target.value) }))}
            />
          </div>
          <div className="col-12">
            <SponsorFieldLabel campaignId={campaignId} screen="Sponsor Interaction" fieldName="Notes">
              Notes
            </SponsorFieldLabel>
            <textarea
              className="form-control"
              rows={4}
              value={form.notes ?? ''}
              onChange={(event) => setForm((currentValue) => ({ ...currentValue, notes: event.target.value || null }))}
            />
          </div>
        </div>

        <div className="campaign-team-drawer__actions mt-3">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose}>
            <i className="bi bi-x-circle me-2" aria-hidden="true" />
            Cancel
          </button>
          <button type="button" className="btn btn-secondary btn-sm" disabled={isSaving} onClick={() => void onSave(form)}>
            <i className={`bi ${isSaving ? 'bi-arrow-repeat' : 'bi-floppy'} me-2`} aria-hidden="true" />
            {interaction ? 'Save Interaction' : 'Add Interaction'}
          </button>
        </div>
      </div>
    </div>
  );
}

function createEmptySponsorForm(): SponsorUpsertInput {
  return {
    firstName: null,
    lastName: null,
    displayName: null,
    organizationName: null,
    email: null,
    phone: null,
    addressLine1: null,
    addressLine2: null,
    city: null,
    state: null,
    postalCode: null,
    preferredContact: 'EMAIL',
    source: 'STAFF_ENTRY',
    sourceDetail: null,
    notes: null,
    isActive: true,
    doNotContact: false,
  };
}

function createEmptyParticipationForm(): SponsorshipUpsertInput {
  return {
    status: 'ACTIVE',
    interestStatus: 'NEW',
    dropOffStatus: 'NOT_STARTED',
    dropOffDueAt: null,
    dropOffCompletedAt: null,
    selfRegistered: false,
    sponsorCode: null,
    notes: null,
  };
}

function createEmptyInteractionForm(): SponsorInteractionUpsertInput {
  return {
    channel: 'CALL',
    direction: 'OUTBOUND',
    subject: null,
    outcome: 'OTHER',
    notes: null,
    occurredAt: new Date().toISOString(),
    followUpAt: null,
  };
}

function toDateTimeInputValue(value: string | null): string {
  if (!value) {
    return '';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  const timezoneOffsetMs = parsed.getTimezoneOffset() * 60 * 1000;
  const localTime = new Date(parsed.getTime() - timezoneOffsetMs);
  return localTime.toISOString().slice(0, 16);
}

function fromDateTimeInputValue(value: string): string | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function formatSponsorDateTime(value: string | null): string {
  if (!value) {
    return 'Not set';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}
