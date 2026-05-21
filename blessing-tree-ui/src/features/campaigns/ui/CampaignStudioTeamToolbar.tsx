export interface CampaignStudioTeamSearchState {
  search: string;
}

interface CampaignStudioTeamToolbarProps {
  searchLabel: string;
  searchPlaceholder: string;
  searchState: CampaignStudioTeamSearchState;
  canManageTeam: boolean;
  addButtonLabel?: string;
  addIconClassName?: string;
  onChange: (next: CampaignStudioTeamSearchState) => void;
  onAdd?: () => void;
}

export function CampaignStudioTeamToolbar({
  searchLabel,
  searchPlaceholder,
  searchState,
  canManageTeam,
  addButtonLabel,
  addIconClassName = 'bi bi-person-plus',
  onChange,
  onAdd,
}: CampaignStudioTeamToolbarProps) {
  return (
    <div className="campaign-team-toolbar">
      <label className="form-label campaign-team-toolbar__search">
        {searchLabel}
        <input
          className="form-control"
          value={searchState.search}
          placeholder={searchPlaceholder}
          onChange={(event) =>
            onChange({
              search: event.target.value,
            })
          }
        />
      </label>

      {canManageTeam && onAdd && addButtonLabel ? (
        <div className="campaign-team-toolbar__actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm campaign-team-toolbar__icon-button"
            aria-label={addButtonLabel}
            title={addButtonLabel}
            onClick={onAdd}
          >
            <i className={addIconClassName} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
