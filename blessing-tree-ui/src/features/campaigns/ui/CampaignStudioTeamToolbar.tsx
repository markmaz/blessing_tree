export interface CampaignStudioTeamSearchState {
  search: string;
}

interface CampaignStudioTeamToolbarProps {
  searchLabel: string;
  searchPlaceholder: string;
  searchState: CampaignStudioTeamSearchState;
  onChange: (next: CampaignStudioTeamSearchState) => void;
}

export function CampaignStudioTeamToolbar({
  searchLabel,
  searchPlaceholder,
  searchState,
  onChange,
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
    </div>
  );
}
