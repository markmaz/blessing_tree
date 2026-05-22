import { useEffect, useMemo, useState } from 'react';
import { CampaignStudioDrawer } from '@/features/campaigns/ui/CampaignStudioDrawer';
import type {
  CampaignAddressSuggestion,
  CampaignPeopleGroup,
  CampaignPeopleGroupContact,
  GroupContactRole,
  GroupContactUpsertInput,
  PreferredContact,
  RecipientGroupType,
  RecipientGroupUpsertInput,
} from '@/features/campaigns/model/campaignPeopleWorkspaceTypes';
import {
  formatContactDisplayName,
  formatShortDate,
  toGroupContactRoleLabel,
  toPreferredContactLabel,
} from '@/features/campaigns/model/campaignPeopleWorkspacePresentation';
import { InlineConfirmAction } from '@/shared/ui/InlineConfirmAction';

interface CampaignPeopleGroupDrawerProps {
  isOpen: boolean;
  isSaving: boolean;
  canEdit: boolean;
  group: CampaignPeopleGroup | null;
  initialGroupType?: RecipientGroupType;
  onClose: () => void;
  onSaveGroup: (input: RecipientGroupUpsertInput, groupId?: string) => Promise<CampaignPeopleGroup | null>;
  onSaveContact: (
    groupId: string,
    input: GroupContactUpsertInput,
    contactId?: string
  ) => Promise<CampaignPeopleGroupContact | null>;
  onDeleteContact: (groupId: string, contactId: string) => Promise<boolean>;
  onSearchAddresses: (query: string) => Promise<CampaignAddressSuggestion[]>;
  onAddRecipientToGroup: (groupId: string) => void;
  onSelectRecipient: (recipientId: string) => void;
}

const emptyGroupDraft = (groupType: RecipientGroupType = 'HOUSEHOLD'): RecipientGroupUpsertInput => ({
  groupType,
  groupName: '',
  intakeSource: '',
  externalReference: '',
  notes: '',
  status: 'ACTIVE',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
});

const emptyContactDraft: GroupContactUpsertInput = {
  contactRole: 'OTHER',
  relationshipLabel: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  preferredContact: 'NONE',
  isPrimary: false,
  canPickUp: false,
  isEmergencyContact: false,
  notes: '',
};

export function CampaignPeopleGroupDrawer({
  isOpen,
  isSaving,
  canEdit,
  group,
  initialGroupType = 'HOUSEHOLD',
  onClose,
  onSaveGroup,
  onSaveContact,
  onDeleteContact,
  onSearchAddresses,
  onAddRecipientToGroup,
  onSelectRecipient,
}: CampaignPeopleGroupDrawerProps) {
  const [groupDraft, setGroupDraft] = useState<RecipientGroupUpsertInput>(() =>
    group
      ? {
          groupType: group.groupType,
          groupName: group.groupName,
          intakeSource: group.intakeSource ?? '',
          externalReference: group.externalReference ?? '',
          notes: group.notes ?? '',
          status: group.status,
          addressLine1: group.addressLine1 ?? '',
          addressLine2: group.addressLine2 ?? '',
          city: group.city ?? '',
          state: group.state ?? '',
          postalCode: group.postalCode ?? '',
        }
      : emptyGroupDraft(initialGroupType)
  );
  const [groupError, setGroupError] = useState<string | null>(null);
  const [contactDraft, setContactDraft] = useState<GroupContactUpsertInput>(emptyContactDraft);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);
  const [addressSuggestions, setAddressSuggestions] = useState<CampaignAddressSuggestion[]>([]);
  const [isSearchingAddresses, setIsSearchingAddresses] = useState(false);
  const [addressLookupQuery, setAddressLookupQuery] = useState('');
  const [isAddressLine1Focused, setIsAddressLine1Focused] = useState(false);
  const [suppressAddressLookupValue, setSuppressAddressLookupValue] = useState<string | null>(null);

  const editingContact = useMemo(
    () => group?.contacts.find((contact) => contact.id === editingContactId) ?? null,
    [editingContactId, group]
  );
  const currentGroupType = groupDraft.groupType;
  const isAdultProgramGroup = currentGroupType === 'ADULT_PROGRAM';
  const groupNameLabel = isAdultProgramGroup ? 'Program Name' : 'Family Name';
  const drawerTitle = group
    ? group.groupName
    : isAdultProgramGroup
      ? 'Add Adult Program'
      : 'Add Family';
  const drawerDescription = group
    ? 'Update the intake record, contacts, and linked people for this campaign.'
    : isAdultProgramGroup
      ? 'Create the adult program first, then add coordinator contacts and participating adults.'
      : 'Create the family first, then add parent or guardian contacts and children.';

  useEffect(() => {
    const query = addressLookupQuery.trim();
    if (
      !isOpen ||
      !isAddressLine1Focused ||
      query.length < 3 ||
      query === suppressAddressLookupValue
    ) {
      return;
    }

    let isCancelled = false;
    const timeoutId = window.setTimeout(() => {
      setIsSearchingAddresses(true);
      void onSearchAddresses(query)
        .then((results) => {
          if (!isCancelled) {
            setAddressSuggestions(results);
          }
        })
        .finally(() => {
          if (!isCancelled) {
            setIsSearchingAddresses(false);
          }
        });
    }, 220);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [
    addressLookupQuery,
    isAddressLine1Focused,
    isOpen,
    onSearchAddresses,
    suppressAddressLookupValue,
  ]);

  const handleSaveGroup = async () => {
    if (!groupDraft.groupName.trim()) {
      setGroupError(`${groupNameLabel} is required.`);
      return;
    }

    setGroupError(null);
    const savedGroup = await onSaveGroup(
      {
        ...groupDraft,
        groupName: groupDraft.groupName.trim(),
      },
      group?.id
    );

    if (savedGroup) {
      setGroupDraft({
        groupType: savedGroup.groupType,
        groupName: savedGroup.groupName,
        intakeSource: savedGroup.intakeSource ?? '',
        externalReference: savedGroup.externalReference ?? '',
        notes: savedGroup.notes ?? '',
        status: savedGroup.status,
        addressLine1: savedGroup.addressLine1 ?? '',
        addressLine2: savedGroup.addressLine2 ?? '',
        city: savedGroup.city ?? '',
        state: savedGroup.state ?? '',
        postalCode: savedGroup.postalCode ?? '',
      });
    }
  };

  const handleEditContact = (contact: CampaignPeopleGroupContact) => {
    setEditingContactId(contact.id);
    setContactError(null);
    setContactDraft({
      contactRole: contact.contactRole,
      relationshipLabel: contact.relationshipLabel ?? '',
      firstName: contact.firstName ?? '',
      lastName: contact.lastName ?? '',
      email: contact.email ?? '',
      phone: contact.phone ?? '',
      preferredContact: contact.preferredContact,
      isPrimary: contact.isPrimary,
      canPickUp: contact.canPickUp,
      isEmergencyContact: contact.isEmergencyContact,
      notes: contact.notes ?? '',
    });
  };

  const resetContactDraft = () => {
    setEditingContactId(null);
    setContactDraft(emptyContactDraft);
    setContactError(null);
  };

  const applyAddressSuggestion = (suggestion: CampaignAddressSuggestion) => {
    setSuppressAddressLookupValue(suggestion.addressLine1);
    setAddressLookupQuery('');
    setIsAddressLine1Focused(false);
    setAddressSuggestions([]);
    setGroupDraft((currentValue) => ({
      ...currentValue,
      addressLine1: suggestion.addressLine1,
      city: suggestion.city ?? currentValue.city ?? '',
      state: suggestion.state ?? currentValue.state ?? '',
      postalCode: suggestion.postalCode ?? currentValue.postalCode ?? '',
    }));
  };

  const handleSaveContact = async () => {
    if (!group?.id) {
      setContactError('Save the group before adding contacts.');
      return;
    }

    if (
      !contactDraft.firstName?.trim() &&
      !contactDraft.lastName?.trim() &&
      !contactDraft.email?.trim() &&
      !contactDraft.phone?.trim()
    ) {
      setContactError('Add at least a name, email, or phone for the contact.');
      return;
    }

    setContactError(null);
    const savedContact = await onSaveContact(
      group.id,
      {
        ...contactDraft,
        relationshipLabel: contactDraft.relationshipLabel?.trim() || null,
        firstName: contactDraft.firstName?.trim() || null,
        lastName: contactDraft.lastName?.trim() || null,
        email: contactDraft.email?.trim() || null,
        phone: contactDraft.phone?.trim() || null,
        notes: contactDraft.notes?.trim() || null,
      },
      editingContactId ?? undefined
    );

    if (savedContact) {
      resetContactDraft();
    }
  };

  return (
    <CampaignStudioDrawer
      isOpen={isOpen}
      width="wide"
      title={drawerTitle}
      description={drawerDescription}
      onClose={onClose}
    >
      <div className="campaign-team-drawer__stack">
        <section className="campaign-team-drawer__section">
          <div className="campaign-team-drawer__section-header">
            <div>
              <h4 className="h6 mb-1">
                {isAdultProgramGroup ? 'Program Details' : 'Family Details'}
              </h4>
              <p className="text-muted mb-0">
                {isAdultProgramGroup
                  ? 'Capture the adult-program information first, then add coordinator contacts and the adults submitted through that program.'
                  : 'Capture the family information first, then add contacts and children from the same intake record.'}
              </p>
            </div>
          </div>

          {groupError ? <div className="alert alert-danger py-2" role="alert">{groupError}</div> : null}

          <div className="campaign-team-form-grid">
            <label className="form-label">
              Group Type
              <select
                className="form-select mt-2"
                value={groupDraft.groupType}
                onChange={(event) =>
                  setGroupDraft((currentValue) => ({
                    ...currentValue,
                    groupType: event.target.value as RecipientGroupType,
                  }))
                }
                disabled={!canEdit}
              >
                <option value="HOUSEHOLD">Household</option>
                <option value="ADULT_PROGRAM">Adult Program</option>
              </select>
            </label>

            <label className="form-label">
              Status
              <select
                className="form-select mt-2"
                value={groupDraft.status ?? 'ACTIVE'}
                onChange={(event) =>
                  setGroupDraft((currentValue) => ({
                    ...currentValue,
                    status: event.target.value as RecipientGroupUpsertInput['status'],
                  }))
                }
                disabled={!canEdit}
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </label>

            <label className="form-label campaign-team-form-grid__span-2">
              {groupNameLabel}
              <input
                className="form-control mt-2"
                value={groupDraft.groupName}
                onChange={(event) =>
                  setGroupDraft((currentValue) => ({
                    ...currentValue,
                    groupName: event.target.value,
                  }))
                }
                disabled={!canEdit}
              />
            </label>

            <label className="form-label">
              Intake Source
              <input
                className="form-control mt-2"
                value={groupDraft.intakeSource ?? ''}
                onChange={(event) =>
                  setGroupDraft((currentValue) => ({
                    ...currentValue,
                    intakeSource: event.target.value,
                  }))
                }
                disabled={!canEdit}
              />
            </label>

            <label className="form-label">
              External Reference
              <input
                className="form-control mt-2"
                value={groupDraft.externalReference ?? ''}
                onChange={(event) =>
                  setGroupDraft((currentValue) => ({
                    ...currentValue,
                    externalReference: event.target.value,
                  }))
                }
                disabled={!canEdit}
              />
            </label>

            <label className="form-label campaign-team-form-grid__span-2">
              Address Line 1
              <input
                className="form-control mt-2"
                value={groupDraft.addressLine1 ?? ''}
                onFocus={() => {
                  setIsAddressLine1Focused(true);
                }}
                onBlur={() => {
                  setIsAddressLine1Focused(false);
                  setIsSearchingAddresses(false);
                  setAddressSuggestions([]);
                }}
                onChange={(event) =>
                  {
                    setSuppressAddressLookupValue(null);
                    setAddressLookupQuery(event.target.value);
                    setAddressSuggestions([]);
                    setGroupDraft((currentValue) => ({
                      ...currentValue,
                      addressLine1: event.target.value,
                    }));
                  }
                }
                disabled={!canEdit}
                placeholder={
                  isAdultProgramGroup ? 'Start typing the program address' : 'Start typing the family address'
                }
              />
              {isSearchingAddresses ? (
                <div className="form-text">Looking up address suggestions...</div>
              ) : null}
              {addressSuggestions.length > 0 ? (
                <div className="campaign-people-address-suggestions mt-2" role="listbox" aria-label="Address suggestions">
                  {addressSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.label}
                      type="button"
                      className="campaign-people-address-suggestion"
                      onMouseDown={(event) => {
                        event.preventDefault();
                      }}
                      onClick={() => applyAddressSuggestion(suggestion)}
                    >
                      <i className="bi bi-geo-alt" aria-hidden="true" />
                      <span>{suggestion.label}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </label>

            <label className="form-label campaign-team-form-grid__span-2">
              Address Line 2
              <input
                className="form-control mt-2"
                value={groupDraft.addressLine2 ?? ''}
                onChange={(event) =>
                  setGroupDraft((currentValue) => ({
                    ...currentValue,
                    addressLine2: event.target.value,
                  }))
                }
                disabled={!canEdit}
              />
            </label>

            <label className="form-label">
              City
              <input
                className="form-control mt-2"
                value={groupDraft.city ?? ''}
                onChange={(event) =>
                  setGroupDraft((currentValue) => ({
                    ...currentValue,
                    city: event.target.value,
                  }))
                }
                disabled={!canEdit}
              />
            </label>

            <label className="form-label">
              State
              <input
                className="form-control mt-2"
                value={groupDraft.state ?? ''}
                onChange={(event) =>
                  setGroupDraft((currentValue) => ({
                    ...currentValue,
                    state: event.target.value,
                  }))
                }
                disabled={!canEdit}
              />
            </label>

            <label className="form-label">
              Postal Code
              <input
                className="form-control mt-2"
                value={groupDraft.postalCode ?? ''}
                onChange={(event) =>
                  setGroupDraft((currentValue) => ({
                    ...currentValue,
                    postalCode: event.target.value,
                  }))
                }
                disabled={!canEdit}
              />
            </label>

            <label className="form-label campaign-team-form-grid__span-2">
              Notes
              <textarea
                className="form-control mt-2"
                rows={4}
                value={groupDraft.notes ?? ''}
                onChange={(event) =>
                  setGroupDraft((currentValue) => ({
                    ...currentValue,
                    notes: event.target.value,
                  }))
                }
                disabled={!canEdit}
              />
            </label>
          </div>

          <div className="campaign-team-drawer__actions mt-3">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                void handleSaveGroup();
              }}
              disabled={!canEdit || isSaving}
            >
              <i className="bi bi-floppy me-2" aria-hidden="true" />
              {group ? 'Save Group' : 'Create Group'}
            </button>
          </div>
        </section>

        {group ? (
          <section className="campaign-team-drawer__section">
            <div className="campaign-team-drawer__section-header">
              <div>
                <h4 className="h6 mb-1">
                  {group.groupType === 'HOUSEHOLD'
                    ? 'Children'
                    : 'Program Members'}
                </h4>
                <p className="text-muted mb-0">
                  {group.groupType === 'HOUSEHOLD'
                    ? 'Capture the children in this family, then open each child to add or refine their wishlist.'
                    : 'Capture the adults in this program, then open each person to add or refine their wishlist and optional direct contact details.'}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => onAddRecipientToGroup(group.id)}
                disabled={!canEdit}
              >
                <i
                  className={`bi ${
                    group.groupType === 'HOUSEHOLD'
                      ? 'bi-person-plus'
                      : 'bi-people-fill'
                  } me-2`}
                  aria-hidden="true"
                />
                {group.groupType === 'HOUSEHOLD'
                  ? 'Add Child'
                  : 'Add Adult'}
              </button>
            </div>

            <div className="campaign-team-inline-list">
              {group.recipients.length === 0 ? (
                <div className="campaign-studio__empty-note">
                  {group.groupType === 'HOUSEHOLD'
                    ? 'No children added yet.'
                    : 'No program members added yet.'}
                </div>
              ) : (
                group.recipients.map((recipient) => (
                  <div key={recipient.id} className="campaign-team-inline-item campaign-team-inline-item--stacked">
                    <div className="campaign-team-inline-item__content">
                      <strong>{recipient.displayLabel}</strong>
                      <div className="campaign-team-inline-meta">
                        <span className="campaign-chip campaign-chip-muted">
                          <i className="bi bi-journal-text me-1" aria-hidden="true" />
                          {recipient.wishlist?.items.length ?? 0} wishlist items
                        </span>
                        <span className="campaign-chip campaign-chip-muted">
                          <i className="bi bi-tag me-1" aria-hidden="true" />
                          {recipient.status}
                        </span>
                      </div>
                      <span className="text-muted small">
                        {[
                          recipient.firstName && recipient.lastName
                            ? `${recipient.firstName} ${recipient.lastName}`
                            : null,
                          recipient.age !== null ? `Age ${recipient.age}` : null,
                          recipient.facilityRoom ? `Room ${recipient.facilityRoom}` : null,
                          recipient.wishlist ? `Wishlist ${recipient.wishlist.wishlistStatus}` : 'No wishlist yet',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </div>
                    <div className="campaign-team-inline-item__actions">
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => onSelectRecipient(recipient.id)}
                      >
                        <i className="bi bi-pencil-square me-2" aria-hidden="true" />
                        {group.groupType === 'HOUSEHOLD'
                          ? 'Open Child'
                          : 'Open Adult'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        ) : null}

        <section className="campaign-team-drawer__section">
          <div className="campaign-team-drawer__section-header">
            <div>
              <h4 className="h6 mb-1">Contacts</h4>
              <p className="text-muted mb-0">
                Parents, guardians, coordinators, social workers, and program staff stay here as operational contacts.
              </p>
            </div>
          </div>

          {!group ? (
            <div className="campaign-studio__empty-note">Save the group before adding contacts.</div>
          ) : (
            <>
              {group.authorizedPickupContacts.length ? (
                <div className="campaign-team-inline-list mb-3">
                  <div className="campaign-team-inline-item campaign-team-inline-item--stacked">
                    <div className="campaign-team-inline-item__content">
                      <strong>Authorized Pickup Contacts</strong>
                      <div className="campaign-team-inline-meta">
                        {group.authorizedPickupContacts.map((contact) => (
                          <span key={contact.id} className="campaign-chip campaign-chip-muted">
                            <i className="bi bi-person-check me-1" aria-hidden="true" />
                            {formatContactDisplayName(contact)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="campaign-team-inline-list mb-3">
                {group.contacts.length === 0 ? (
                  <div className="campaign-studio__empty-note">No contacts yet.</div>
                ) : (
                  group.contacts.map((contact) => (
                    <div key={contact.id} className="campaign-team-inline-item campaign-team-inline-item--stacked">
                      <div className="campaign-team-inline-item__content">
                        <strong>
                          {[contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Unnamed contact'}
                        </strong>
                        <div className="campaign-team-inline-meta">
                          <span className="campaign-chip">{toGroupContactRoleLabel(contact.contactRole)}</span>
                          {contact.isPrimary ? <span className="campaign-chip">Primary</span> : null}
                          {contact.canPickUp ? <span className="campaign-chip">Can Pick Up</span> : null}
                          {contact.isEmergencyContact ? <span className="campaign-chip">Emergency</span> : null}
                        </div>
                        <span className="text-muted small">
                          {[contact.email, contact.phone, toPreferredContactLabel(contact.preferredContact)]
                            .filter(Boolean)
                            .join(' · ') || `Updated ${formatShortDate(contact.updatedAt)}`}
                        </span>
                      </div>
                      <div className="campaign-team-inline-item__actions">
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          onClick={() => handleEditContact(contact)}
                          disabled={!canEdit}
                        >
                          <i className="bi bi-pencil-square me-2" aria-hidden="true" />
                          Edit
                        </button>
                        <InlineConfirmAction
                          buttonLabel="Delete"
                          confirmLabel="Delete Contact"
                          message="Remove this contact from the group?"
                          disabled={!canEdit}
                          onConfirm={async () => {
                            await onDeleteContact(group.id, contact.id);
                            if (editingContactId === contact.id) {
                              resetContactDraft();
                            }
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="campaign-team-form-grid">
                {contactError ? (
                  <div className="campaign-team-form-grid__span-2 alert alert-danger py-2 mb-0" role="alert">
                    {contactError}
                  </div>
                ) : null}

                <label className="form-label">
                  Contact Role
                  <select
                    className="form-select mt-2"
                    value={contactDraft.contactRole}
                    onChange={(event) =>
                      setContactDraft((currentValue) => ({
                        ...currentValue,
                        contactRole: event.target.value as GroupContactRole,
                      }))
                    }
                    disabled={!canEdit}
                  >
                    <option value="PARENT">Parent</option>
                    <option value="GUARDIAN">Guardian</option>
                    <option value="SOCIAL_WORKER">Social Worker</option>
                    <option value="STAFF">Staff</option>
                    <option value="COORDINATOR">Coordinator</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>

                <label className="form-label">
                  Relationship Label
                  <input
                    className="form-control mt-2"
                    value={contactDraft.relationshipLabel ?? ''}
                    onChange={(event) =>
                      setContactDraft((currentValue) => ({
                        ...currentValue,
                        relationshipLabel: event.target.value,
                      }))
                    }
                    disabled={!canEdit}
                  />
                </label>

                <label className="form-label">
                  First Name
                  <input
                    className="form-control mt-2"
                    value={contactDraft.firstName ?? ''}
                    onChange={(event) =>
                      setContactDraft((currentValue) => ({
                        ...currentValue,
                        firstName: event.target.value,
                      }))
                    }
                    disabled={!canEdit}
                  />
                </label>

                <label className="form-label">
                  Last Name
                  <input
                    className="form-control mt-2"
                    value={contactDraft.lastName ?? ''}
                    onChange={(event) =>
                      setContactDraft((currentValue) => ({
                        ...currentValue,
                        lastName: event.target.value,
                      }))
                    }
                    disabled={!canEdit}
                  />
                </label>

                <label className="form-label">
                  Email
                  <input
                    className="form-control mt-2"
                    type="email"
                    value={contactDraft.email ?? ''}
                    onChange={(event) =>
                      setContactDraft((currentValue) => ({
                        ...currentValue,
                        email: event.target.value,
                      }))
                    }
                    disabled={!canEdit}
                  />
                </label>

                <label className="form-label">
                  Phone
                  <input
                    className="form-control mt-2"
                    value={contactDraft.phone ?? ''}
                    onChange={(event) =>
                      setContactDraft((currentValue) => ({
                        ...currentValue,
                        phone: event.target.value,
                      }))
                    }
                    disabled={!canEdit}
                  />
                </label>

                <label className="form-label">
                  Preferred Contact
                  <select
                    className="form-select mt-2"
                    value={contactDraft.preferredContact ?? 'NONE'}
                    onChange={(event) =>
                      setContactDraft((currentValue) => ({
                        ...currentValue,
                        preferredContact: event.target.value as PreferredContact,
                      }))
                    }
                    disabled={!canEdit}
                  >
                    <option value="NONE">None</option>
                    <option value="EMAIL">Email</option>
                    <option value="PHONE">Phone</option>
                    <option value="TEXT">Text</option>
                  </select>
                </label>

                <label className="form-label campaign-team-form-grid__span-2">
                  Notes
                  <textarea
                    className="form-control mt-2"
                    rows={3}
                    value={contactDraft.notes ?? ''}
                    onChange={(event) =>
                      setContactDraft((currentValue) => ({
                        ...currentValue,
                        notes: event.target.value,
                      }))
                    }
                    disabled={!canEdit}
                  />
                </label>

                <label className="campaign-team-checkbox">
                  <input
                    type="checkbox"
                    checked={contactDraft.isPrimary ?? false}
                    onChange={(event) =>
                      setContactDraft((currentValue) => ({
                        ...currentValue,
                        isPrimary: event.target.checked,
                      }))
                    }
                    disabled={!canEdit}
                  />
                  <span>Primary contact</span>
                </label>

                <label className="campaign-team-checkbox">
                  <input
                    type="checkbox"
                    checked={contactDraft.canPickUp ?? false}
                    onChange={(event) =>
                      setContactDraft((currentValue) => ({
                        ...currentValue,
                        canPickUp: event.target.checked,
                      }))
                    }
                    disabled={!canEdit}
                  />
                  <span>Can pick up gifts</span>
                </label>

                <label className="campaign-team-checkbox campaign-team-form-grid__span-2">
                  <input
                    type="checkbox"
                    checked={contactDraft.isEmergencyContact ?? false}
                    onChange={(event) =>
                      setContactDraft((currentValue) => ({
                        ...currentValue,
                        isEmergencyContact: event.target.checked,
                      }))
                    }
                    disabled={!canEdit}
                  />
                  <span>Emergency contact</span>
                </label>
              </div>

              <div className="campaign-team-drawer__actions mt-3">
                {editingContact ? (
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={resetContactDraft}
                    disabled={!canEdit}
                  >
                    <i className="bi bi-arrow-counterclockwise me-2" aria-hidden="true" />
                    Clear Contact Form
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    void handleSaveContact();
                  }}
                  disabled={!canEdit || isSaving}
                >
                  <i className={`bi ${editingContact ? 'bi-floppy' : 'bi-person-plus'} me-2`} aria-hidden="true" />
                  {editingContact ? 'Save Contact' : 'Add Contact'}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </CampaignStudioDrawer>
  );
}
