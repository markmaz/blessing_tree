import { createPortal } from 'react-dom';
import { useEffect, useMemo, useState } from 'react';
import { CampaignStudioDrawer } from '@/features/campaigns/ui/CampaignStudioDrawer';
import type {
  CampaignPeopleGroup,
  CampaignRecipient,
  CampaignWishlistItem,
  OrganizationTypeOption,
  RecipientAgeUnit,
  RecipientPrivacyLevel,
  RecipientStatus,
  RecipientUpsertInput,
  WishlistIntakeMethod,
  WishlistItemType,
  WishlistItemUpsertInput,
} from '@/features/campaigns/model/campaignPeopleWorkspaceTypes';
import {
  formatContactDisplayName,
  formatCurrencyFromCents,
  formatRecipientAge,
  formatShortDate,
  toGiftWorkflowStatusLabel,
  toRecipientProgramTypeLabel,
  toWishlistIntakeMethodLabel,
  toWishlistItemTypeLabel,
} from '@/features/campaigns/model/campaignPeopleWorkspacePresentation';
import { AutoDismissAlert } from '@/shared/ui/AutoDismissAlert';
import { ConfirmationModal } from '@/shared/ui/ConfirmationModal';

interface CampaignPeopleRecipientDrawerProps {
  isOpen: boolean;
  isSaving: boolean;
  canEdit: boolean;
  recipient: CampaignRecipient | null;
  initialGroupId?: string | null;
  lockedGroupId?: string | null;
  groups: CampaignPeopleGroup[];
  recipients: CampaignRecipient[];
  organizationTypes?: OrganizationTypeOption[];
  onClose: () => void;
  onSaveRecipient: (
    input: RecipientUpsertInput,
    recipientId?: string
  ) => Promise<CampaignRecipient | null>;
  onSaveWishlistItem: (
    recipientId: string,
    input: WishlistItemUpsertInput,
    itemId?: string
  ) => Promise<CampaignWishlistItem | null>;
  onDeleteWishlistItem: (recipientId: string, itemId: string) => Promise<boolean>;
  onDeleteRecipient: (recipientId: string) => Promise<boolean>;
  onSelectExistingRecipient: (recipientId: string) => void;
  onStartAnotherRecipient?: (() => void) | null;
  openGiftEditorOnMount?: boolean;
  onGiftEditorAutoOpened?: (() => void) | null;
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
  { value: 'U', label: 'Prefer not to say' },
  { value: 'X', label: 'Other' },
] as const;

function buildDisplayLabel(firstName: string | null | undefined, lastName: string | null | undefined): string {
  return [firstName?.trim(), lastName?.trim()].filter(Boolean).join(' ');
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
    ageUnit: recipient?.ageUnit ?? 'YEARS',
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

export function CampaignPeopleRecipientDrawer({
  isOpen,
  isSaving,
  canEdit,
  recipient,
  initialGroupId = null,
  lockedGroupId = null,
  groups,
  recipients,
  organizationTypes = [],
  onClose,
  onSaveRecipient,
  onSaveWishlistItem,
  onDeleteWishlistItem,
  onDeleteRecipient,
  onSelectExistingRecipient,
  onStartAnotherRecipient = null,
  openGiftEditorOnMount = false,
  onGiftEditorAutoOpened = null,
}: CampaignPeopleRecipientDrawerProps) {
  const [recipientDraft, setRecipientDraft] = useState<RecipientUpsertInput>(
    buildRecipientDraft(recipient, initialGroupId)
  );
  const [recipientError, setRecipientError] = useState<string | null>(null);
  const [itemDraft, setItemDraft] = useState<WishlistItemFormState>(emptyWishlistItemDraft);
  const [itemError, setItemError] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isDeleteRecipientModalOpen, setIsDeleteRecipientModalOpen] = useState(false);
  const [isDeleteItemModalOpen, setIsDeleteItemModalOpen] = useState(false);
  const [pendingDeleteItemId, setPendingDeleteItemId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isProfileSectionOpen, setIsProfileSectionOpen] = useState(() => recipient === null);
  const [isWishlistSectionOpen, setIsWishlistSectionOpen] = useState(true);
  const [isWishlistMetaOpen, setIsWishlistMetaOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);

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
  const recipientProgram =
    selectedGroup?.groupType === 'HOUSEHOLD'
      ? { recipientKind: 'CHILD' as const, programType: 'CHILD_FAMILY' as const }
      : selectedGroup?.groupType === 'ORGANIZATION'
        ? getOrganizationRecipientCategory(selectedGroup.organizationType, organizationTypes) === 'CHILD'
          ? { recipientKind: 'CHILD' as const, programType: 'ORGANIZATION_CHILD' as const }
          : { recipientKind: 'ADULT' as const, programType: 'ORGANIZATION_ADULT' as const }
        : recipient?.programType === 'ORGANIZATION_CHILD'
          ? { recipientKind: 'CHILD' as const, programType: 'ORGANIZATION_CHILD' as const }
          : recipient?.programType === 'ORGANIZATION_ADULT'
            ? { recipientKind: 'ADULT' as const, programType: 'ORGANIZATION_ADULT' as const }
            : null;

  const visibleContacts = selectedGroup?.contacts ?? [];
  const pickupContacts = visibleContacts.filter((contact) => contact.canPickUp);
  const pendingDeleteItem =
    recipient?.wishlist?.items.find((item) => item.id === pendingDeleteItemId) ?? null;
  const isContextualIntake = lockedGroup !== null;
  const isHouseholdIntake = selectedGroup?.groupType === 'HOUSEHOLD';
  const isOrganizationIntake = selectedGroup?.groupType === 'ORGANIZATION';
  const isOrganizationChildIntake = recipientProgram?.programType === 'ORGANIZATION_CHILD';
  const isOrganizationAdultIntake = recipientProgram?.programType === 'ORGANIZATION_ADULT';
  const isChildIntake = isHouseholdIntake || isOrganizationChildIntake;
  const showAdultDirectContact = isOrganizationAdultIntake;
  const nextRecipientButtonLabel = isHouseholdIntake
    ? 'Add Another Child'
    : isOrganizationAdultIntake
      ? 'Add Another Adult'
      : isOrganizationChildIntake
        ? 'Add Another Child'
        : 'Add Another Person';
  const recipientRecordLabel = isHouseholdIntake
    ? 'Child'
    : isOrganizationAdultIntake
      ? 'Adult'
      : isOrganizationChildIntake
        ? 'Child'
        : 'Person';
  const addGiftButtonLabel = `Add Gift for ${recipientRecordLabel}`;
  const deleteRecipientButtonLabel = isHouseholdIntake
    ? 'Delete Child'
    : isOrganizationAdultIntake
      ? 'Delete Adult'
      : isOrganizationChildIntake
        ? 'Delete Child'
        : 'Delete Person';
  const drawerTitle = recipient?.displayLabel
    ? isHouseholdIntake
      ? 'Child Intake'
      : isOrganizationAdultIntake
        ? 'Adult Intake'
        : isOrganizationChildIntake
          ? 'Child Intake'
        : recipient.displayLabel
    : isHouseholdIntake
      ? 'Add Child'
      : isOrganizationAdultIntake
        ? 'Add Adult'
        : isOrganizationChildIntake
          ? 'Add Child'
        : 'Add Person';
  const drawerDescription = isHouseholdIntake
    ? 'Capture child details and wishlist items for this family intake.'
    : isOrganizationAdultIntake
      ? 'Capture adult details, optional direct contact information, and wishlist items for this organization intake.'
      : isOrganizationChildIntake
        ? 'Capture child details and wishlist items for this organization intake.'
      : 'Manage the recipient profile and their campaign wishlist from one drawer.';
  const possibleDuplicateRecipients = useMemo(() => {
    const normalizedDisplayName = computedDisplayLabel.trim().toLowerCase();
    const normalizedFirstName = recipientDraft.firstName?.trim().toLowerCase() ?? '';
    const normalizedLastName = recipientDraft.lastName?.trim().toLowerCase() ?? '';
    const age = recipientDraft.age;
    const ageUnit = recipientDraft.ageUnit ?? 'YEARS';

    if (
      normalizedDisplayName.length < 3 &&
      (normalizedFirstName.length < 2 || normalizedLastName.length < 2)
    ) {
      return [];
    }

    return recipients
      .filter((candidate) => candidate.id !== recipient?.id)
      .filter((candidate) => {
        const candidateDisplayName = candidate.displayLabel.trim().toLowerCase();
        const candidateFirstName = candidate.firstName?.trim().toLowerCase() ?? '';
        const candidateLastName = candidate.lastName?.trim().toLowerCase() ?? '';
        const sameGroup = candidate.recipientGroupId === recipientDraft.recipientGroupId;
        const exactDisplayName = normalizedDisplayName.length >= 3 && candidateDisplayName === normalizedDisplayName;
        const matchingName =
          normalizedFirstName.length >= 2 &&
          normalizedLastName.length >= 2 &&
          candidateFirstName === normalizedFirstName &&
          candidateLastName === normalizedLastName;
        const matchingAge =
          age !== null &&
          age !== undefined &&
          candidate.age === age &&
          (candidate.ageUnit ?? 'YEARS') === ageUnit;

        if (sameGroup && (exactDisplayName || matchingName)) {
          return true;
        }

        return matchingName && matchingAge;
      })
      .sort((left, right) => {
        const leftSameGroup = left.recipientGroupId === recipientDraft.recipientGroupId ? 0 : 1;
        const rightSameGroup = right.recipientGroupId === recipientDraft.recipientGroupId ? 0 : 1;
        return leftSameGroup - rightSameGroup || left.displayLabel.localeCompare(right.displayLabel);
      })
      .slice(0, 4);
  }, [
    computedDisplayLabel,
    recipient?.id,
    recipientDraft.age,
    recipientDraft.ageUnit,
    recipientDraft.firstName,
    recipientDraft.lastName,
    recipientDraft.recipientGroupId,
    recipients,
  ]);

  const deleteRecipientDetails = useMemo(() => {
    if (!recipient) {
      return [];
    }
    const wishlistItemCount = recipient.wishlist?.items.length ?? 0;
    return [
      `${deleteRecipientButtonLabel.replace('Delete ', '')} record: ${recipient.displayLabel}`,
      recipient.wishlist ? '1 wishlist record' : 'No wishlist record',
      `${wishlistItemCount} gift item${wishlistItemCount === 1 ? '' : 's'} from this wishlist`,
    ];
  }, [deleteRecipientButtonLabel, recipient]);

  const handleSaveRecipient = async () => {
    if (!recipientDraft.recipientGroupId) {
      setRecipientError('Choose a household or organization first.');
      return;
    }
    if (!isChildIntake && !computedDisplayLabel.trim()) {
      setRecipientError('First or last name is required.');
      return;
    }
    if (!recipientProgram) {
      setRecipientError('Choose a valid group before saving.');
      return;
    }

    setRecipientError(null);
    try {
      const savedRecipient = await onSaveRecipient(
        {
          ...recipientDraft,
          recipientGroupId: lockedGroupId ?? recipientDraft.recipientGroupId,
          displayLabel: isChildIntake ? (recipient?.displayLabel ?? '') : computedDisplayLabel.trim(),
          recipientKind: recipientProgram.recipientKind,
          programType: recipientProgram.programType,
          firstName: isChildIntake ? null : recipientDraft.firstName?.trim() || null,
          lastName: isChildIntake ? null : recipientDraft.lastName?.trim() || null,
          birthYear: recipientDraft.birthYear ?? null,
          ageUnit: recipientDraft.age ? recipientDraft.ageUnit ?? 'YEARS' : null,
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
      if (savedRecipient) {
        setSuccessMessage(
          recipient
            ? `${recipientRecordLabel} updated.`
            : `${recipientRecordLabel} added.`
        );
      }
    } catch (saveError) {
      setRecipientError(saveError instanceof Error ? saveError.message : 'Unable to save this person.');
    }
  };

  const handleEditItem = (item: CampaignWishlistItem) => {
    setEditingItemId(item.id);
    setItemError(null);
    setIsItemModalOpen(true);
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

  const handleOpenNewItemModal = () => {
    resetItemDraft();
    setIsItemModalOpen(true);
  };

  useEffect(() => {
    if (!openGiftEditorOnMount || !recipient?.id) {
      return;
    }
    setEditingItemId(null);
    setItemDraft(emptyWishlistItemDraft);
    setItemError(null);
    setIsWishlistSectionOpen(true);
    setIsItemModalOpen(true);
    onGiftEditorAutoOpened?.();
  }, [onGiftEditorAutoOpened, openGiftEditorOnMount, recipient?.id]);

  const handleCloseItemModal = () => {
    resetItemDraft();
    setIsItemModalOpen(false);
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
    try {
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
        setSuccessMessage(editingItemId ? 'Wishlist item updated.' : 'Wishlist item added.');
        handleCloseItemModal();
      }
    } catch (saveError) {
      setItemError(saveError instanceof Error ? saveError.message : 'Unable to save this wishlist item.');
    }
  };

  return (
    <CampaignStudioDrawer
      isOpen={isOpen}
      width="xwide"
      title={drawerTitle}
      description={drawerDescription}
      onClose={onClose}
    >
      {successMessage ? (
        <AutoDismissAlert
          key={successMessage}
          message={successMessage}
          onDismiss={() => setSuccessMessage(null)}
          className="mb-3"
        />
      ) : null}
      {recipient ? (
        <div className="campaign-team-drawer__actions mb-3">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleOpenNewItemModal}
            disabled={!canEdit || isSaving}
          >
            <i className="bi bi-plus-square me-2" aria-hidden="true" />
            {addGiftButtonLabel}
          </button>
          {onStartAnotherRecipient ? (
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => {
                setSuccessMessage(null);
                onStartAnotherRecipient();
              }}
              disabled={!canEdit || isSaving}
            >
              <i className="bi bi-person-plus me-2" aria-hidden="true" />
              {nextRecipientButtonLabel}
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="campaign-team-drawer__stack">
        <section className="campaign-team-drawer__section">
          <div className="campaign-team-drawer__section-header">
            <div className="campaign-people-section-heading">
              <button
                type="button"
                className="campaign-people-section-heading__toggle"
                onClick={() => setIsProfileSectionOpen((currentValue) => !currentValue)}
                aria-expanded={isProfileSectionOpen}
                aria-label={isProfileSectionOpen ? 'Collapse person details' : 'Expand person details'}
              >
                <i
                  className={`bi ${isProfileSectionOpen ? 'bi-chevron-down' : 'bi-chevron-right'}`}
                  aria-hidden="true"
                />
              </button>
              <div>
                <h4 className="h6 mb-1">
                {isHouseholdIntake
                  ? 'Child Details'
                  : isOrganizationAdultIntake
                    ? 'Adult Details'
                    : isOrganizationChildIntake
                      ? 'Child Details'
                    : 'Person Details'}
                </h4>
                <p className="text-muted mb-0">
                  {isHouseholdIntake
                    ? 'Children belong to a family intake, so contact information stays on the household record.'
                    : isOrganizationAdultIntake
                      ? 'Adults in an organization can keep their own address and direct contact details here, while coordinators stay on the group record.'
                      : isOrganizationChildIntake
                        ? 'Children in an organization stay linked to the organization, while coordinator contact information stays on the group record.'
                      : 'Each person is the actual gift recipient. The selected group determines the intake program.'}
                </p>
              </div>
            </div>
          </div>

          {recipientError ? <div className="alert alert-danger py-2" role="alert">{recipientError}</div> : null}
          {!recipient && possibleDuplicateRecipients.length > 0 ? (
            <div className="alert alert-warning py-2" role="alert">
              <div className="fw-semibold mb-2">Possible existing people</div>
              <div className="small text-muted mb-2">
                Review these before creating a new person record.
              </div>
              <div className="d-flex flex-column gap-2">
                {possibleDuplicateRecipients.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    className="btn btn-outline-warning btn-sm text-start"
                    onClick={() => onSelectExistingRecipient(candidate.id)}
                  >
                    <span className="d-flex align-items-start gap-2">
                      <i className="bi bi-person-bounding-box" aria-hidden="true" />
                      <span className="d-flex flex-column">
                      <span className="fw-semibold">{candidate.displayLabel}</span>
                      <span className="small text-muted">
                        {[
                          candidate.programRecipientId,
                          candidate.group?.groupName,
                          candidate.age !== null ? formatRecipientAge(candidate.age, candidate.ageUnit) : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {isProfileSectionOpen ? (
          <div className="campaign-team-form-grid">
            {isContextualIntake ? (
              <label className="form-label campaign-team-form-grid__span-2">
                {lockedGroup?.groupType === 'HOUSEHOLD'
                  ? 'Family'
                  : 'Organization'}
                <input
                  className="form-control mt-2"
                  value={lockedGroup?.groupName ?? ''}
                  disabled
                />
              </label>
            ) : (
              <label className="form-label campaign-team-form-grid__span-2">
                Household or Organization
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
              {isChildIntake
                ? 'Child Label'
                : isOrganizationAdultIntake
                  ? 'Adult Display Name'
                  : 'Display Name'}
              <input
                className="form-control mt-2"
                value={isChildIntake ? recipient?.displayLabel ?? 'Assigned after save' : computedDisplayLabel}
                disabled
              />
            </label>

            {!isChildIntake ? (
              <>
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
              </>
            ) : (
              <div className="campaign-studio__empty-note campaign-team-form-grid__span-2">
                Child names are assigned automatically in family order, such as Child One and Child Two.
              </div>
            )}

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
                  }))
                }
                disabled={!canEdit}
              />
            </label>

            <label className="form-label">
              Age Unit
              <select
                className="form-select mt-2"
                value={recipientDraft.ageUnit ?? 'YEARS'}
                onChange={(event) =>
                  setRecipientDraft((currentValue) => ({
                    ...currentValue,
                    ageUnit: event.target.value as RecipientAgeUnit,
                  }))
                }
                disabled={!canEdit}
              >
                <option value="YEARS">Years</option>
                <option value="MONTHS">Months</option>
              </select>
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

            {isOrganizationIntake ? (
              <>
                <label className="form-label">
                  Person ID
                  <input
                    className="form-control mt-2"
                    value={recipient?.programRecipientId ?? 'Generated after save'}
                    disabled
                  />
                </label>

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

            {isOrganizationAdultIntake ? (
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
                : isOrganizationAdultIntake
                  ? 'Adult Notes'
                  : isOrganizationChildIntake
                    ? 'Child Notes'
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
          ) : (
            <div className="campaign-people-section-summary">
              <div className="campaign-chip-row">
                <span className="campaign-chip campaign-chip-muted">
                  <i className="bi bi-person-badge me-1" aria-hidden="true" />
                  {computedDisplayLabel || 'Unnamed person'}
                </span>
                <span className="campaign-chip campaign-chip-muted">
                  <i className="bi bi-diagram-3 me-1" aria-hidden="true" />
                  {selectedGroup?.groupName ?? 'No group'}
                </span>
                <span className="campaign-chip campaign-chip-muted">
                  <i className="bi bi-signpost me-1" aria-hidden="true" />
                  {recipientProgram ? toRecipientProgramTypeLabel(recipientProgram.programType) : 'No program'}
                </span>
                {recipient?.programRecipientId ? (
                  <span className="campaign-chip campaign-chip-muted">
                    <i className="bi bi-upc-scan me-1" aria-hidden="true" />
                    {recipient.programRecipientId}
                  </span>
                ) : null}
              </div>
            </div>
          )}

          <div className="campaign-team-drawer__actions mt-3">
            {recipient ? (
              <button
                type="button"
                className="btn btn-outline-danger btn-sm"
                onClick={() => setIsDeleteRecipientModalOpen(true)}
                disabled={!canEdit || isSaving}
              >
                <i className="bi bi-trash3 me-2" aria-hidden="true" />
                {deleteRecipientButtonLabel}
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                void handleSaveRecipient();
              }}
              disabled={!canEdit || isSaving}
            >
              <i className="bi bi-floppy me-2" aria-hidden="true" />
              {recipient ? `Save ${recipientRecordLabel}` : `Create ${recipientRecordLabel}`}
            </button>
          </div>
        </section>

        <section className="campaign-team-drawer__section">
          <div className="campaign-team-drawer__section-header">
            <div className="campaign-people-section-heading">
              <button
                type="button"
                className="campaign-people-section-heading__toggle"
                onClick={() => setIsWishlistSectionOpen((currentValue) => !currentValue)}
                aria-expanded={isWishlistSectionOpen}
                aria-label={isWishlistSectionOpen ? 'Collapse wishlist' : 'Expand wishlist'}
              >
                <i
                  className={`bi ${isWishlistSectionOpen ? 'bi-chevron-down' : 'bi-chevron-right'}`}
                  aria-hidden="true"
                />
              </button>
              <div>
                <h4 className="h6 mb-1">Wishlist</h4>
                <p className="text-muted mb-0">Keep one gift wishlist per person, with structured items ready for sponsorship and fulfillment.</p>
              </div>
            </div>
          </div>

          {!recipient ? (
            <div className="campaign-studio__empty-note">Save the person before editing the wishlist.</div>
          ) : isWishlistSectionOpen ? (
            <>
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
                        : 'No pickup contacts are marked yet on this household or organization.'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="campaign-people-gifts mt-4">
                <div className="campaign-team-workspace__section-header">
                  <div>
                    <h5 className="h6 mb-1">Gift Items</h5>
                    <p className="text-muted mb-0">Keep wishlist items in a compact table and open a focused editor only when you need to add or change a gift.</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm campaign-team-workspace__section-action"
                    onClick={handleOpenNewItemModal}
                    disabled={!canEdit}
                  >
                    <i className="bi bi-plus-square" aria-hidden="true" />
                    <span>Add Gift</span>
                  </button>
                </div>

                {recipient.wishlist?.items.length ? (
                  <div className="campaign-team-table-wrap mt-3">
                    <table className="table campaign-team-table mb-0">
                      <thead>
                        <tr>
                          <th>Gift</th>
                          <th>Type</th>
                          <th>Qty</th>
                          <th>Priority</th>
                          <th>Status</th>
                          <th>Details</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recipient.wishlist.items.map((item) => (
                          <tr
                            key={item.id}
                            className="campaign-team-table__row campaign-people-gift-row"
                            role="button"
                            tabIndex={0}
                            onClick={() => handleEditItem(item)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                handleEditItem(item);
                              }
                            }}
                          >
                            <td>
                              <div className="campaign-people-group-child-primary">
                                <strong>{item.description}</strong>
                                {item.category ? <span>{item.category}</span> : null}
                              </div>
                            </td>
                            <td>{toWishlistItemTypeLabel(item.itemType)}</td>
                            <td>{item.qtyRequested}</td>
                            <td>{item.priority}</td>
                            <td>
                              {toGiftWorkflowStatusLabel(
                                item.giftWorkflow.isPickedUp,
                                item.giftWorkflow.isFullyFulfilled,
                                item.giftWorkflow.sponsorshipStatus
                              )}
                            </td>
                            <td className="text-muted small">
                              {[item.size, formatCurrencyFromCents(item.estCostCents), `Updated ${formatShortDate(item.updatedAt)}`]
                                .filter(Boolean)
                                .join(' · ') || 'No extra details'}
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-outline-danger btn-sm"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setPendingDeleteItemId(item.id);
                                  setIsDeleteItemModalOpen(true);
                                }}
                                disabled={!canEdit}
                              >
                                <i className="bi bi-trash3" aria-hidden="true" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="campaign-studio__empty-note mt-3">No wishlist items yet.</div>
                )}

                {onStartAnotherRecipient ? (
                  <div className="campaign-team-drawer__actions mt-3">
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => {
                        setSuccessMessage(null);
                        onStartAnotherRecipient();
                      }}
                      disabled={!canEdit || isSaving}
                    >
                      <i className="bi bi-person-plus me-2" aria-hidden="true" />
                      {nextRecipientButtonLabel}
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <div className="campaign-people-section-summary">
              <div className="campaign-chip-row">
                <span className="campaign-chip campaign-chip-muted">
                  <i className="bi bi-gift me-1" aria-hidden="true" />
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
            </div>
          )}
        </section>
      </div>
      {recipient ? (
        <details
          className="campaign-people-metadata-details mt-3"
          open={isWishlistMetaOpen}
          onToggle={(event) => setIsWishlistMetaOpen((event.currentTarget as HTMLDetailsElement).open)}
        >
          <summary className="campaign-people-metadata-details__summary">
            <i className="bi bi-info-circle me-2" aria-hidden="true" />
            Wishlist Metadata
          </summary>
          <div className="campaign-team-form-grid mt-3">
            <label className="form-label">
              Wishlist Status
              <input
                className="form-control mt-2"
                value={recipient.wishlist?.wishlistStatus ?? 'READY'}
                disabled
              />
            </label>

            <label className="form-label">
              Intake Method
              <input
                className="form-control mt-2"
                value={recipient.wishlist?.intakeMethod ? toWishlistIntakeMethodLabel(recipient.wishlist.intakeMethod as WishlistIntakeMethod) : 'Not set'}
                disabled
              />
            </label>

            <label className="form-label">
              Submitted At
              <input
                className="form-control mt-2"
                value={recipient.wishlist?.submittedAt ? formatShortDate(recipient.wishlist.submittedAt) : 'Not set'}
                disabled
              />
            </label>

            <label className="form-label campaign-team-form-grid__span-2">
              Intake Completed By
              <input
                className="form-control mt-2"
                value={recipient.wishlist?.intakeCompletedByContact ? formatContactDisplayName(recipient.wishlist.intakeCompletedByContact) : 'Not set'}
                disabled
              />
            </label>
          </div>
        </details>
      ) : null}
      {recipient && isItemModalOpen
        ? createPortal(
            <div className="campaign-people-modal__backdrop" role="presentation" onClick={handleCloseItemModal}>
              <div
                className="campaign-people-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="campaign-people-gift-modal-title"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="campaign-people-modal__header">
                  <div>
                    <div className="campaign-studio__eyebrow">Wishlist Item</div>
                    <h3 id="campaign-people-gift-modal-title" className="h5 mb-1">
                      {editingItemId ? 'Edit Gift Item' : 'Add Gift Item'}
                    </h3>
                    <p className="small text-muted mb-0">
                      Keep gift edits focused here so the main person drawer stays easy to scan.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={handleCloseItemModal}
                  >
                    <i className="bi bi-x-lg me-2" aria-hidden="true" />
                    Close
                  </button>
                </div>

                <div className="campaign-team-form-grid">
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
                      className="btn btn-outline-danger btn-sm"
                      onClick={() => {
                        setPendingDeleteItemId(editingItemId);
                        setIsDeleteItemModalOpen(true);
                      }}
                      disabled={!canEdit}
                    >
                      <i className="bi bi-trash3 me-2" aria-hidden="true" />
                      Delete Item
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={handleCloseItemModal}
                  >
                    <i className="bi bi-x-circle me-2" aria-hidden="true" />
                    Cancel
                  </button>
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
              </div>
            </div>,
            document.body
          )
        : null}
      {recipient ? (
        <ConfirmationModal
          open={isDeleteRecipientModalOpen}
          title={deleteRecipientButtonLabel}
          message={`Delete ${recipient.displayLabel}? This cannot be undone.`}
          details={deleteRecipientDetails}
          confirmLabel={deleteRecipientButtonLabel}
          isSubmitting={isDeleting}
          onClose={() => setIsDeleteRecipientModalOpen(false)}
          onConfirm={async () => {
            setIsDeleting(true);
            try {
              const didDelete = await onDeleteRecipient(recipient.id);
              if (didDelete) {
                setIsDeleteRecipientModalOpen(false);
                onClose();
              }
            } finally {
              setIsDeleting(false);
            }
          }}
        />
      ) : null}
      {recipient && pendingDeleteItem ? (
        <ConfirmationModal
          open={isDeleteItemModalOpen}
          title="Delete Gift Item"
          message="Delete this gift from the wishlist? This cannot be undone."
          details={[
            `Gift item: ${pendingDeleteItem.description || 'Untitled item'}`,
            `Type: ${toWishlistItemTypeLabel(pendingDeleteItem.itemType)}`,
          ]}
          confirmLabel="Delete Gift"
          isSubmitting={isDeleting}
          onClose={() => {
            setIsDeleteItemModalOpen(false);
            setPendingDeleteItemId(null);
          }}
          onConfirm={async () => {
            setIsDeleting(true);
            try {
              const didDelete = await onDeleteWishlistItem(recipient.id, pendingDeleteItem.id);
              if (didDelete) {
                setSuccessMessage('Wishlist item removed.');
                setIsDeleteItemModalOpen(false);
                setPendingDeleteItemId(null);
                if (editingItemId === pendingDeleteItem.id) {
                  handleCloseItemModal();
                }
              }
            } finally {
              setIsDeleting(false);
            }
          }}
        />
      ) : null}
    </CampaignStudioDrawer>
  );
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

function getOrganizationRecipientCategory(
  organizationTypeCode: string | null | undefined,
  organizationTypes: OrganizationTypeOption[]
): OrganizationTypeOption['recipientCategory'] {
  const organizationType = organizationTypes.find((type) => type.code === organizationTypeCode);
  if (organizationType) {
    return organizationType.recipientCategory;
  }

  return ['ORPHANAGE', 'CHILDRENS_HOME'].includes(organizationTypeCode ?? '') ? 'CHILD' : 'ADULT';
}
