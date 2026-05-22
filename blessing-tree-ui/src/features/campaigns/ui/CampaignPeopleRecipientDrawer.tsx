import { useMemo, useState } from 'react';
import { CampaignStudioDrawer } from '@/features/campaigns/ui/CampaignStudioDrawer';
import type {
  CampaignPeopleGroup,
  CampaignRecipient,
  CampaignWishlistItem,
  RecipientPrivacyLevel,
  RecipientStatus,
  RecipientUpsertInput,
  WishlistIntakeMethod,
  WishlistItemType,
  WishlistItemUpsertInput,
  WishlistStatus,
  WishlistUpsertInput,
} from '@/features/campaigns/model/campaignPeopleWorkspaceTypes';
import {
  formatContactDisplayName,
  formatCurrencyFromCents,
  formatShortDate,
  toGiftWorkflowStatusLabel,
  toRecipientProgramTypeLabel,
  toWishlistItemTypeLabel,
} from '@/features/campaigns/model/campaignPeopleWorkspacePresentation';
import { InlineConfirmAction } from '@/shared/ui/InlineConfirmAction';

interface CampaignPeopleRecipientDrawerProps {
  isOpen: boolean;
  isSaving: boolean;
  canEdit: boolean;
  recipient: CampaignRecipient | null;
  initialGroupId?: string | null;
  lockedGroupId?: string | null;
  groups: CampaignPeopleGroup[];
  onClose: () => void;
  onSaveRecipient: (
    input: RecipientUpsertInput,
    recipientId?: string
  ) => Promise<CampaignRecipient | null>;
  onSaveWishlist: (
    recipientId: string,
    input: WishlistUpsertInput
  ) => Promise<unknown>;
  onSaveWishlistItem: (
    recipientId: string,
    input: WishlistItemUpsertInput,
    itemId?: string
  ) => Promise<CampaignWishlistItem | null>;
  onDeleteWishlistItem: (recipientId: string, itemId: string) => Promise<boolean>;
}

interface WishlistItemFormState {
  category: string;
  itemType: WishlistItemType;
  description: string;
  size: string;
  qtyRequested: string;
  priority: string;
  estCostDollars: string;
  allowSubstitute: boolean;
  doNotSubstituteReason: string;
  recipientNote: string;
  notes: string;
}

const emptyWishlistItemDraft: WishlistItemFormState = {
  category: '',
  itemType: 'GIFT',
  description: '',
  size: '',
  qtyRequested: '1',
  priority: 'MEDIUM',
  estCostDollars: '',
  allowSubstitute: true,
  doNotSubstituteReason: '',
  recipientNote: '',
  notes: '',
};

const genderOptions = [
  { value: '', label: 'Not set' },
  { value: 'F', label: 'Female' },
  { value: 'M', label: 'Male' },
  { value: 'PNTS', label: 'Prefer not to say' },
  { value: 'OTHER', label: 'Other' },
] as const;

function buildDisplayLabel(firstName: string | null | undefined, lastName: string | null | undefined): string {
  return [firstName?.trim(), lastName?.trim()].filter(Boolean).join(' ');
}

function deriveBirthYear(age: number | null | undefined): number | null {
  if (age === null || age === undefined || Number.isNaN(age)) {
    return null;
  }
  return new Date().getFullYear() - age;
}

function buildRecipientDraft(
  recipient: CampaignRecipient | null,
  initialGroupId: string | null
): RecipientUpsertInput {
  return {
    recipientGroupId: recipient?.recipientGroupId ?? initialGroupId ?? '',
    displayLabel: recipient?.displayLabel ?? '',
    privacyLevel: recipient?.privacyLevel ?? 'FULL_NAME',
    firstName: recipient?.firstName ?? '',
    lastName: recipient?.lastName ?? '',
    birthYear: recipient?.birthYear ?? null,
    age: recipient?.age ?? null,
    gender: recipient?.gender ?? '',
    addressLine1: recipient?.addressLine1 ?? '',
    addressLine2: recipient?.addressLine2 ?? '',
    city: recipient?.city ?? '',
    state: recipient?.state ?? '',
    postalCode: recipient?.postalCode ?? '',
    directEmail: recipient?.directEmail ?? '',
    directPhone: recipient?.directPhone ?? '',
    facilityRoom: recipient?.facilityRoom ?? '',
    subgroupLabel: recipient?.subgroupLabel ?? '',
    mobilityNotes: recipient?.mobilityNotes ?? '',
    notes: recipient?.notes ?? '',
    status: recipient?.status ?? 'ACTIVE',
  };
}

function buildWishlistDraft(recipient: CampaignRecipient | null): WishlistUpsertInput {
  return {
    wishlistStatus: recipient?.wishlist?.wishlistStatus ?? 'DRAFT',
    intakeMethod: recipient?.wishlist?.intakeMethod ?? null,
    submittedAt: toDateTimeLocalValue(recipient?.wishlist?.submittedAt ?? null),
    intakeCompletedByContactId: recipient?.wishlist?.intakeCompletedByContactId ?? null,
    notes: recipient?.wishlist?.notes ?? '',
  };
}

export function CampaignPeopleRecipientDrawer({
  isOpen,
  isSaving,
  canEdit,
  recipient,
  initialGroupId = null,
  lockedGroupId = null,
  groups,
  onClose,
  onSaveRecipient,
  onSaveWishlist,
  onSaveWishlistItem,
  onDeleteWishlistItem,
}: CampaignPeopleRecipientDrawerProps) {
  const [recipientDraft, setRecipientDraft] = useState<RecipientUpsertInput>(
    buildRecipientDraft(recipient, initialGroupId)
  );
  const [recipientError, setRecipientError] = useState<string | null>(null);
  const [wishlistDraft, setWishlistDraft] = useState<WishlistUpsertInput>(buildWishlistDraft(recipient));
  const [wishlistError, setWishlistError] = useState<string | null>(null);
  const [itemDraft, setItemDraft] = useState<WishlistItemFormState>(emptyWishlistItemDraft);
  const [itemError, setItemError] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === recipientDraft.recipientGroupId) ?? null,
    [groups, recipientDraft.recipientGroupId]
  );
  const lockedGroup = useMemo(
    () => (lockedGroupId ? groups.find((group) => group.id === lockedGroupId) ?? null : null),
    [groups, lockedGroupId]
  );
  const genderOptionList = useMemo(() => {
    const currentGender = recipientDraft.gender?.trim() ?? '';
    if (!currentGender || genderOptions.some((option) => option.value === currentGender)) {
      return genderOptions;
    }
    return [
      ...genderOptions,
      { value: currentGender, label: `Current value: ${currentGender}` },
    ];
  }, [recipientDraft.gender]);
  const computedDisplayLabel = useMemo(() => {
    const generated = buildDisplayLabel(recipientDraft.firstName, recipientDraft.lastName);
    return generated || recipientDraft.displayLabel || '';
  }, [recipientDraft.displayLabel, recipientDraft.firstName, recipientDraft.lastName]);
  const computedBirthYear = useMemo(() => {
    return deriveBirthYear(recipientDraft.age) ?? recipientDraft.birthYear ?? null;
  }, [recipientDraft.age, recipientDraft.birthYear]);

  const recipientProgram = selectedGroup?.groupType === 'ADULT_PROGRAM'
    ? { recipientKind: 'ADULT' as const, programType: 'ADULT_PROGRAM' as const }
    : selectedGroup
      ? { recipientKind: 'CHILD' as const, programType: 'CHILD_FAMILY' as const }
      : null;

  const visibleContacts = selectedGroup?.contacts ?? [];
  const pickupContacts = visibleContacts.filter((contact) => contact.canPickUp);
  const isContextualIntake = lockedGroup !== null;
  const isHouseholdIntake = selectedGroup?.groupType === 'HOUSEHOLD';
  const isAdultProgramIntake = selectedGroup?.groupType === 'ADULT_PROGRAM';
  const showAdultDirectContact = selectedGroup?.groupType === 'ADULT_PROGRAM';
  const drawerTitle = recipient?.displayLabel
    ? isHouseholdIntake
      ? 'Child Intake'
      : isAdultProgramIntake
        ? 'Adult Intake'
        : recipient.displayLabel
    : isHouseholdIntake
      ? 'Add Child'
      : isAdultProgramIntake
        ? 'Add Adult'
        : 'Add Person';
  const drawerDescription = isHouseholdIntake
    ? 'Capture child details and wishlist items for this family intake.'
    : isAdultProgramIntake
      ? 'Capture adult details, optional direct contact information, and wishlist items for this adult program intake.'
      : 'Manage the recipient profile and their campaign wishlist from one drawer.';

  const handleSaveRecipient = async () => {
    if (!recipientDraft.recipientGroupId) {
      setRecipientError('Choose a household or adult program first.');
      return;
    }
    if (!computedDisplayLabel.trim()) {
      setRecipientError('First or last name is required.');
      return;
    }
    if (!recipientProgram) {
      setRecipientError('Choose a valid group before saving.');
      return;
    }

    setRecipientError(null);
    await onSaveRecipient(
      {
        ...recipientDraft,
        recipientGroupId: lockedGroupId ?? recipientDraft.recipientGroupId,
        displayLabel: computedDisplayLabel.trim(),
        recipientKind: recipientProgram.recipientKind,
        programType: recipientProgram.programType,
        firstName: recipientDraft.firstName?.trim() || null,
        lastName: recipientDraft.lastName?.trim() || null,
        birthYear: computedBirthYear,
        gender: recipientDraft.gender?.trim() || null,
        addressLine1: recipientDraft.addressLine1?.trim() || null,
        addressLine2: recipientDraft.addressLine2?.trim() || null,
        city: recipientDraft.city?.trim() || null,
        state: recipientDraft.state?.trim() || null,
        postalCode: recipientDraft.postalCode?.trim() || null,
        directEmail: recipientDraft.directEmail?.trim() || null,
        directPhone: recipientDraft.directPhone?.trim() || null,
        facilityRoom: recipientDraft.facilityRoom?.trim() || null,
        subgroupLabel: recipientDraft.subgroupLabel?.trim() || null,
        mobilityNotes: recipientDraft.mobilityNotes?.trim() || null,
        notes: recipientDraft.notes?.trim() || null,
      },
      recipient?.id
    );
  };

  const handleSaveWishlist = async () => {
    if (!recipient?.id) {
      setWishlistError('Save the person before editing the wishlist.');
      return;
    }

    setWishlistError(null);
    await onSaveWishlist(recipient.id, {
      wishlistStatus: wishlistDraft.wishlistStatus ?? 'DRAFT',
      intakeMethod: wishlistDraft.intakeMethod ?? null,
      submittedAt: wishlistDraft.submittedAt ? toIsoFromDateTimeLocal(wishlistDraft.submittedAt) : null,
      intakeCompletedByContactId: wishlistDraft.intakeCompletedByContactId ?? null,
      notes: wishlistDraft.notes?.trim() || null,
    });
  };

  const handleEditItem = (item: CampaignWishlistItem) => {
    setEditingItemId(item.id);
    setItemError(null);
    setItemDraft({
      category: item.category ?? '',
      itemType: item.itemType,
      description: item.description,
      size: item.size ?? '',
      qtyRequested: String(item.qtyRequested),
      priority: item.priority,
      estCostDollars:
        item.estCostCents === null ? '' : (item.estCostCents / 100).toFixed(2),
      allowSubstitute: item.allowSubstitute,
      doNotSubstituteReason: item.doNotSubstituteReason ?? '',
      recipientNote: item.recipientNote ?? '',
      notes: item.notes ?? '',
    });
  };

  const resetItemDraft = () => {
    setEditingItemId(null);
    setItemDraft(emptyWishlistItemDraft);
    setItemError(null);
  };

  const handleSaveItem = async () => {
    if (!recipient?.id) {
      setItemError('Save the person before adding wishlist items.');
      return;
    }
    if (!itemDraft.description.trim()) {
      setItemError('Item description is required.');
      return;
    }

    const estCostCents = parseCostDollars(itemDraft.estCostDollars);
    if (itemDraft.estCostDollars.trim() && estCostCents === null) {
      setItemError('Estimated cost must be a valid dollar amount.');
      return;
    }

    setItemError(null);
    const savedItem = await onSaveWishlistItem(
      recipient.id,
      {
        category: itemDraft.category.trim() || null,
        itemType: itemDraft.itemType,
        description: itemDraft.description.trim(),
        size: itemDraft.size.trim() || null,
        qtyRequested: Number(itemDraft.qtyRequested || '1'),
        priority: itemDraft.priority.trim().toUpperCase(),
        estCostCents,
        allowSubstitute: itemDraft.allowSubstitute,
        doNotSubstituteReason: itemDraft.doNotSubstituteReason.trim() || null,
        recipientNote: itemDraft.recipientNote.trim() || null,
        notes: itemDraft.notes.trim() || null,
      },
      editingItemId ?? undefined
    );

    if (savedItem) {
      resetItemDraft();
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
                {isHouseholdIntake
                  ? 'Child Details'
                  : isAdultProgramIntake
                    ? 'Adult Details'
                    : 'Person Details'}
              </h4>
              <p className="text-muted mb-0">
                {isHouseholdIntake
                  ? 'Children belong to a family intake, so contact information stays on the household record.'
                  : isAdultProgramIntake
                    ? 'Adults in an adult program can keep their own address and direct contact details here, while coordinators stay on the group record.'
                    : 'Each person is the actual gift recipient. The selected group determines the intake program.'}
              </p>
            </div>
          </div>

          {recipientError ? <div className="alert alert-danger py-2" role="alert">{recipientError}</div> : null}

          <div className="campaign-team-form-grid">
            {isContextualIntake ? (
              <label className="form-label campaign-team-form-grid__span-2">
                {lockedGroup?.groupType === 'HOUSEHOLD'
                  ? 'Family'
                  : 'Program'}
                <input
                  className="form-control mt-2"
                  value={lockedGroup?.groupName ?? ''}
                  disabled
                />
              </label>
            ) : (
              <label className="form-label campaign-team-form-grid__span-2">
                Household or Adult Program
                <select
                  className="form-select mt-2"
                  value={recipientDraft.recipientGroupId}
                  onChange={(event) =>
                    setRecipientDraft((currentValue) => ({
                      ...currentValue,
                      recipientGroupId: event.target.value,
                    }))
                  }
                  disabled={!canEdit}
                >
                  <option value="">Select a group</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.groupName}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="form-label">
              Program
              <input
                className="form-control mt-2"
                value={recipientProgram ? toRecipientProgramTypeLabel(recipientProgram.programType) : 'Select a group first'}
                disabled
              />
            </label>

            <label className="form-label">
              Status
              <select
                className="form-select mt-2"
                value={recipientDraft.status ?? 'ACTIVE'}
                onChange={(event) =>
                  setRecipientDraft((currentValue) => ({
                    ...currentValue,
                    status: event.target.value as RecipientStatus,
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
              {isHouseholdIntake
                ? 'Child Display Name'
                : isAdultProgramIntake
                  ? 'Adult Display Name'
                  : 'Display Name'}
              <input
                className="form-control mt-2"
                value={computedDisplayLabel}
                disabled
              />
            </label>

            <label className="form-label">
              First Name
              <input
                className="form-control mt-2"
                value={recipientDraft.firstName ?? ''}
                onChange={(event) =>
                  setRecipientDraft((currentValue) => ({
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
                value={recipientDraft.lastName ?? ''}
                onChange={(event) =>
                  setRecipientDraft((currentValue) => ({
                    ...currentValue,
                    lastName: event.target.value,
                  }))
                }
                disabled={!canEdit}
              />
            </label>

            <label className="form-label">
              Age
              <input
                className="form-control mt-2"
                type="number"
                min="0"
                value={recipientDraft.age ?? ''}
                onChange={(event) =>
                  setRecipientDraft((currentValue) => ({
                    ...currentValue,
                    age: event.target.value ? Number(event.target.value) : null,
                    birthYear: event.target.value ? deriveBirthYear(Number(event.target.value)) : null,
                  }))
                }
                disabled={!canEdit}
              />
            </label>

            <label className="form-label">
              Birth Year
              <input
                className="form-control mt-2"
                type="number"
                min="1900"
                max="3000"
                value={computedBirthYear ?? ''}
                disabled
              />
            </label>

            <label className="form-label">
              Gender
              <select
                className="form-select mt-2"
                value={recipientDraft.gender ?? ''}
                onChange={(event) =>
                  setRecipientDraft((currentValue) => ({
                    ...currentValue,
                    gender: event.target.value,
                  }))
                }
                disabled={!canEdit}
              >
                {genderOptionList.map((option) => (
                  <option key={option.value || 'unset'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-label">
              Privacy Level
              <select
                className="form-select mt-2"
                value={recipientDraft.privacyLevel ?? 'FULL_NAME'}
                onChange={(event) =>
                  setRecipientDraft((currentValue) => ({
                    ...currentValue,
                    privacyLevel: event.target.value as RecipientPrivacyLevel,
                  }))
                }
                disabled={!canEdit}
              >
                <option value="FULL_NAME">Full Name</option>
                <option value="INITIALS">Initials</option>
                <option value="ANONYMOUS">Anonymous</option>
              </select>
            </label>

            {selectedGroup?.groupType === 'ADULT_PROGRAM' ? (
              <>
                <label className="form-label">
                  Room / Unit
                  <input
                    className="form-control mt-2"
                    value={recipientDraft.facilityRoom ?? ''}
                    onChange={(event) =>
                      setRecipientDraft((currentValue) => ({
                        ...currentValue,
                        facilityRoom: event.target.value,
                      }))
                    }
                    disabled={!canEdit}
                  />
                </label>

                <label className="form-label">
                  Subgroup Label
                  <input
                    className="form-control mt-2"
                    value={recipientDraft.subgroupLabel ?? ''}
                    onChange={(event) =>
                      setRecipientDraft((currentValue) => ({
                        ...currentValue,
                        subgroupLabel: event.target.value,
                      }))
                    }
                    disabled={!canEdit}
                  />
                </label>
              </>
            ) : null}

            {showAdultDirectContact ? (
              <>
                <label className="form-label campaign-team-form-grid__span-2">
                  Home Address Line 1
                  <input
                    className="form-control mt-2"
                    value={recipientDraft.addressLine1 ?? ''}
                    onChange={(event) =>
                      setRecipientDraft((currentValue) => ({
                        ...currentValue,
                        addressLine1: event.target.value,
                      }))
                    }
                    disabled={!canEdit}
                  />
                </label>

                <label className="form-label campaign-team-form-grid__span-2">
                  Address Line 2
                  <input
                    className="form-control mt-2"
                    value={recipientDraft.addressLine2 ?? ''}
                    onChange={(event) =>
                      setRecipientDraft((currentValue) => ({
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
                    value={recipientDraft.city ?? ''}
                    onChange={(event) =>
                      setRecipientDraft((currentValue) => ({
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
                    value={recipientDraft.state ?? ''}
                    onChange={(event) =>
                      setRecipientDraft((currentValue) => ({
                        ...currentValue,
                        state: event.target.value,
                      }))
                    }
                    disabled={!canEdit}
                  />
                </label>

                <label className="form-label">
                  ZIP Code
                  <input
                    className="form-control mt-2"
                    value={recipientDraft.postalCode ?? ''}
                    onChange={(event) =>
                      setRecipientDraft((currentValue) => ({
                        ...currentValue,
                        postalCode: event.target.value,
                      }))
                    }
                    disabled={!canEdit}
                  />
                </label>

                <label className="form-label">
                  Direct Email
                  <input
                    className="form-control mt-2"
                    type="email"
                    value={recipientDraft.directEmail ?? ''}
                    onChange={(event) =>
                      setRecipientDraft((currentValue) => ({
                        ...currentValue,
                        directEmail: event.target.value,
                      }))
                    }
                    disabled={!canEdit}
                  />
                </label>

                <label className="form-label">
                  Direct Phone
                  <input
                    className="form-control mt-2"
                    value={recipientDraft.directPhone ?? ''}
                    onChange={(event) =>
                      setRecipientDraft((currentValue) => ({
                        ...currentValue,
                        directPhone: event.target.value,
                      }))
                    }
                    disabled={!canEdit}
                  />
                </label>
              </>
            ) : null}

            {selectedGroup?.groupType === 'ADULT_PROGRAM' ? (
              <label className="form-label campaign-team-form-grid__span-2">
                Mobility Notes
                <textarea
                  className="form-control mt-2"
                  rows={3}
                  value={recipientDraft.mobilityNotes ?? ''}
                  onChange={(event) =>
                    setRecipientDraft((currentValue) => ({
                      ...currentValue,
                      mobilityNotes: event.target.value,
                    }))
                  }
                  disabled={!canEdit}
                />
              </label>
            ) : null}

            <label className="form-label campaign-team-form-grid__span-2">
              {isHouseholdIntake
                ? 'Child Notes'
                : isAdultProgramIntake
                  ? 'Adult Notes'
                  : 'Notes'}
              <textarea
                className="form-control mt-2"
                rows={4}
                value={recipientDraft.notes ?? ''}
                onChange={(event) =>
                  setRecipientDraft((currentValue) => ({
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
                void handleSaveRecipient();
              }}
              disabled={!canEdit || isSaving}
            >
              <i className="bi bi-floppy me-2" aria-hidden="true" />
              {recipient ? 'Save Person' : 'Create Person'}
            </button>
          </div>
        </section>

        <section className="campaign-team-drawer__section">
          <div className="campaign-team-drawer__section-header">
            <div>
              <h4 className="h6 mb-1">Wishlist</h4>
              <p className="text-muted mb-0">Keep one gift wishlist per person, with structured items ready for sponsorship and fulfillment.</p>
            </div>
          </div>

          {!recipient ? (
            <div className="campaign-studio__empty-note">Save the person before editing the wishlist.</div>
          ) : (
            <>
              {wishlistError ? <div className="alert alert-danger py-2" role="alert">{wishlistError}</div> : null}

              <div className="campaign-team-form-grid">
                <label className="form-label">
                  Wishlist Status
                  <select
                    className="form-select mt-2"
                    value={wishlistDraft.wishlistStatus ?? 'DRAFT'}
                    onChange={(event) =>
                      setWishlistDraft((currentValue) => ({
                        ...currentValue,
                        wishlistStatus: event.target.value as WishlistStatus,
                      }))
                    }
                    disabled={!canEdit}
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="READY">Ready</option>
                    <option value="LOCKED">Locked</option>
                  </select>
                </label>

                <label className="form-label">
                  Intake Method
                  <select
                    className="form-select mt-2"
                    value={wishlistDraft.intakeMethod ?? ''}
                    onChange={(event) =>
                      setWishlistDraft((currentValue) => ({
                        ...currentValue,
                        intakeMethod: event.target.value ? (event.target.value as WishlistIntakeMethod) : null,
                      }))
                    }
                    disabled={!canEdit}
                  >
                    <option value="">Not set</option>
                    <option value="PHONE">Phone</option>
                    <option value="FORM">Form</option>
                    <option value="STAFF_ENTRY">Staff Entry</option>
                    <option value="IMPORT">Import</option>
                  </select>
                </label>

                <label className="form-label">
                  Submitted At
                  <input
                    className="form-control mt-2"
                    type="datetime-local"
                    value={wishlistDraft.submittedAt ?? ''}
                    onChange={(event) =>
                      setWishlistDraft((currentValue) => ({
                        ...currentValue,
                        submittedAt: event.target.value,
                      }))
                    }
                    disabled={!canEdit}
                  />
                </label>

                <label className="form-label">
                  Intake Completed By
                  <select
                    className="form-select mt-2"
                    value={wishlistDraft.intakeCompletedByContactId ?? ''}
                    onChange={(event) =>
                      setWishlistDraft((currentValue) => ({
                        ...currentValue,
                        intakeCompletedByContactId: event.target.value || null,
                      }))
                    }
                    disabled={!canEdit}
                  >
                    <option value="">Not set</option>
                    {visibleContacts.map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {[contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Unnamed contact'}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-label campaign-team-form-grid__span-2">
                  Wishlist Notes
                  <textarea
                    className="form-control mt-2"
                    rows={3}
                    value={wishlistDraft.notes ?? ''}
                    onChange={(event) =>
                      setWishlistDraft((currentValue) => ({
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
                    void handleSaveWishlist();
                  }}
                  disabled={!canEdit || isSaving}
                >
                  <i className="bi bi-journal-check me-2" aria-hidden="true" />
                  Save Wishlist
                </button>
              </div>

              <div className="campaign-team-inline-list mt-4">
                <div className="campaign-team-inline-item campaign-team-inline-item--stacked">
                  <div className="campaign-team-inline-item__content">
                    <strong>Gift Workflow Readiness</strong>
                    <div className="campaign-team-inline-meta">
                      <span className="campaign-chip campaign-chip-muted">
                        <i className="bi bi-list-check me-1" aria-hidden="true" />
                        {recipient.wishlist?.items.length ?? 0} items
                      </span>
                      <span className="campaign-chip campaign-chip-muted">
                        <i className="bi bi-person-hearts me-1" aria-hidden="true" />
                        {recipient.wishlist?.items.filter((item) => item.giftWorkflow.sponsorshipStatus === 'SPONSORED').length ?? 0} sponsored
                      </span>
                      <span className="campaign-chip campaign-chip-muted">
                        <i className="bi bi-box-seam me-1" aria-hidden="true" />
                        {recipient.wishlist?.items.filter((item) => item.giftWorkflow.isFullyFulfilled).length ?? 0} fulfilled
                      </span>
                    </div>
                    <span className="text-muted small">
                      {pickupContacts.length
                        ? `Authorized pickup contacts: ${pickupContacts.map((contact) => formatContactDisplayName(contact)).join(', ')}`
                        : 'No pickup contacts are marked yet on this household or adult program.'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="campaign-team-inline-list mt-4">
                {recipient.wishlist?.items.length ? (
                  recipient.wishlist.items.map((item) => (
                    <div key={item.id} className="campaign-team-inline-item campaign-team-inline-item--stacked">
                      <div className="campaign-team-inline-item__content">
                        <strong>{item.description}</strong>
                        <div className="campaign-team-inline-meta">
                          <span className="campaign-chip">{toWishlistItemTypeLabel(item.itemType)}</span>
                          <span className="campaign-chip campaign-chip-muted">Qty {item.qtyRequested}</span>
                          <span className="campaign-chip campaign-chip-muted">{item.priority}</span>
                          <span className="campaign-chip campaign-chip-muted">
                            {toGiftWorkflowStatusLabel(
                              item.giftWorkflow.isPickedUp,
                              item.giftWorkflow.isFullyFulfilled,
                              item.giftWorkflow.sponsorshipStatus
                            )}
                          </span>
                        </div>
                        <span className="text-muted small">
                          {[item.category, item.size, formatCurrencyFromCents(item.estCostCents), `Updated ${formatShortDate(item.updatedAt)}`]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                        <span className="text-muted small">
                          {[
                            item.giftWorkflow.sponsorshipStatus === 'SPONSORED'
                              ? `Committed ${item.giftWorkflow.qtyCommitted}`
                              : 'Not sponsored yet',
                            `Fulfilled ${item.giftWorkflow.qtyFulfilled}/${item.qtyRequested}`,
                            `Label ${item.giftWorkflow.labelCode}`,
                            item.giftWorkflow.labelPrintCount > 0
                              ? `Printed ${item.giftWorkflow.labelPrintCount}`
                              : 'Not printed',
                            item.giftWorkflow.pickedUpAt
                              ? `Picked up ${formatShortDate(item.giftWorkflow.pickedUpAt)}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </div>
                      <div className="campaign-team-inline-item__actions">
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          onClick={() => handleEditItem(item)}
                          disabled={!canEdit}
                        >
                          <i className="bi bi-pencil-square me-2" aria-hidden="true" />
                          Edit
                        </button>
                        <InlineConfirmAction
                          buttonLabel="Delete"
                          confirmLabel="Delete Item"
                          message="Remove this wishlist item?"
                          disabled={!canEdit}
                          onConfirm={async () => {
                            await onDeleteWishlistItem(recipient.id, item.id);
                            if (editingItemId === item.id) {
                              resetItemDraft();
                            }
                          }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="campaign-studio__empty-note">No wishlist items yet.</div>
                )}
              </div>

              <div className="campaign-team-form-grid mt-3">
                {itemError ? (
                  <div className="campaign-team-form-grid__span-2 alert alert-danger py-2 mb-0" role="alert">
                    {itemError}
                  </div>
                ) : null}

                <label className="form-label campaign-team-form-grid__span-2">
                  Description
                  <input
                    className="form-control mt-2"
                    value={itemDraft.description}
                    onChange={(event) =>
                      setItemDraft((currentValue) => ({
                        ...currentValue,
                        description: event.target.value,
                      }))
                    }
                    disabled={!canEdit}
                  />
                </label>

                <label className="form-label">
                  Item Type
                  <select
                    className="form-select mt-2"
                    value={itemDraft.itemType}
                    onChange={(event) =>
                      setItemDraft((currentValue) => ({
                        ...currentValue,
                        itemType: event.target.value as WishlistItemType,
                      }))
                    }
                    disabled={!canEdit}
                  >
                    <option value="GIFT">Gift</option>
                    <option value="CLOTHING">Clothing</option>
                    <option value="ESSENTIAL">Essential</option>
                    <option value="GIFT_CARD">Gift Card</option>
                    <option value="EXPERIENCE">Experience</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>

                <label className="form-label">
                  Category
                  <input
                    className="form-control mt-2"
                    value={itemDraft.category}
                    onChange={(event) =>
                      setItemDraft((currentValue) => ({
                        ...currentValue,
                        category: event.target.value,
                      }))
                    }
                    disabled={!canEdit}
                  />
                </label>

                <label className="form-label">
                  Size
                  <input
                    className="form-control mt-2"
                    value={itemDraft.size}
                    onChange={(event) =>
                      setItemDraft((currentValue) => ({
                        ...currentValue,
                        size: event.target.value,
                      }))
                    }
                    disabled={!canEdit}
                  />
                </label>

                <label className="form-label">
                  Quantity
                  <input
                    className="form-control mt-2"
                    type="number"
                    min="1"
                    value={itemDraft.qtyRequested}
                    onChange={(event) =>
                      setItemDraft((currentValue) => ({
                        ...currentValue,
                        qtyRequested: event.target.value,
                      }))
                    }
                    disabled={!canEdit}
                  />
                </label>

                <label className="form-label">
                  Priority
                  <select
                    className="form-select mt-2"
                    value={itemDraft.priority}
                    onChange={(event) =>
                      setItemDraft((currentValue) => ({
                        ...currentValue,
                        priority: event.target.value,
                      }))
                    }
                    disabled={!canEdit}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </label>

                <label className="form-label">
                  Estimated Cost (USD)
                  <input
                    className="form-control mt-2"
                    type="number"
                    min="0"
                    step="0.01"
                    value={itemDraft.estCostDollars}
                    onChange={(event) =>
                      setItemDraft((currentValue) => ({
                        ...currentValue,
                        estCostDollars: event.target.value,
                      }))
                    }
                    disabled={!canEdit}
                  />
                </label>

                <label className="form-label campaign-team-form-grid__span-2">
                  Recipient Note
                  <textarea
                    className="form-control mt-2"
                    rows={2}
                    value={itemDraft.recipientNote}
                    onChange={(event) =>
                      setItemDraft((currentValue) => ({
                        ...currentValue,
                        recipientNote: event.target.value,
                      }))
                    }
                    disabled={!canEdit}
                  />
                </label>

                <label className="form-label campaign-team-form-grid__span-2">
                  Item Notes
                  <textarea
                    className="form-control mt-2"
                    rows={2}
                    value={itemDraft.notes}
                    onChange={(event) =>
                      setItemDraft((currentValue) => ({
                        ...currentValue,
                        notes: event.target.value,
                      }))
                    }
                    disabled={!canEdit}
                  />
                </label>

                <label className="campaign-team-checkbox campaign-team-form-grid__span-2">
                  <input
                    type="checkbox"
                    checked={itemDraft.allowSubstitute}
                    onChange={(event) =>
                      setItemDraft((currentValue) => ({
                        ...currentValue,
                        allowSubstitute: event.target.checked,
                      }))
                    }
                    disabled={!canEdit}
                  />
                  <span>Allow substitution</span>
                </label>

                {!itemDraft.allowSubstitute ? (
                  <label className="form-label campaign-team-form-grid__span-2">
                    Do Not Substitute Reason
                    <textarea
                      className="form-control mt-2"
                      rows={2}
                      value={itemDraft.doNotSubstituteReason}
                      onChange={(event) =>
                        setItemDraft((currentValue) => ({
                          ...currentValue,
                          doNotSubstituteReason: event.target.value,
                        }))
                      }
                      disabled={!canEdit}
                    />
                  </label>
                ) : null}
              </div>

              <div className="campaign-team-drawer__actions mt-3">
                {editingItemId ? (
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={resetItemDraft}
                    disabled={!canEdit}
                  >
                    <i className="bi bi-arrow-counterclockwise me-2" aria-hidden="true" />
                    Clear Item Form
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    void handleSaveItem();
                  }}
                  disabled={!canEdit || isSaving}
                >
                  <i className={`bi ${editingItemId ? 'bi-floppy' : 'bi-plus-square'} me-2`} aria-hidden="true" />
                  {editingItemId ? 'Save Item' : 'Add Item'}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </CampaignStudioDrawer>
  );
}

function toDateTimeLocalValue(value: string | null): string {
  if (!value) {
    return '';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  const year = parsed.getFullYear();
  const month = `${parsed.getMonth() + 1}`.padStart(2, '0');
  const day = `${parsed.getDate()}`.padStart(2, '0');
  const hour = `${parsed.getHours()}`.padStart(2, '0');
  const minute = `${parsed.getMinutes()}`.padStart(2, '0');
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function toIsoFromDateTimeLocal(value: string): string {
  return new Date(value).toISOString();
}

function parseCostDollars(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return Math.round(parsed * 100);
}
