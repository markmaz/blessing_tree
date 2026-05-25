import { useMemo, useState, type KeyboardEvent } from 'react';
import {
  createMilestoneDefinition,
  createReadinessRule,
  updateMilestoneDefinition,
  updateReadinessRule,
} from '@/features/admin/api/campaignOperationsApi';
import type {
  CampaignOperationMilestoneDefinition,
  CampaignOperationReadinessRule,
  CampaignOperationRuleOptions,
  SaveCampaignOperationMilestoneDefinitionInput,
  SaveCampaignOperationReadinessRuleInput,
} from '@/features/admin/model/campaignOperationsTypes';
import { AutoDismissAlert } from '@/shared/ui/AutoDismissAlert';
import { AdminWorkspaceDrawer } from '@/features/admin/ui/AdminWorkspaceDrawer';
import '@/features/admin/ui/adminUsers.css';
import '@/features/admin/ui/adminCampaignOperations.css';

interface AdminCampaignOperationsWorkspaceProps {
  milestoneDefinitions: CampaignOperationMilestoneDefinition[];
  readinessRules: CampaignOperationReadinessRule[];
  options: CampaignOperationRuleOptions;
  onDataChanged: () => Promise<void>;
}

type WorkspaceTab = 'milestones' | 'rules';
type DrawerMode = 'milestone' | 'rule' | null;

export function AdminCampaignOperationsWorkspace({
  milestoneDefinitions,
  readinessRules,
  options,
  onDataChanged,
}: AdminCampaignOperationsWorkspaceProps) {
  const [selectedTab, setSelectedTab] = useState<WorkspaceTab>('milestones');
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const selectedMilestone = useMemo(
    () => milestoneDefinitions.find((definition) => definition.id === selectedMilestoneId) ?? null,
    [milestoneDefinitions, selectedMilestoneId]
  );
  const selectedRule = useMemo(
    () => readinessRules.find((rule) => rule.id === selectedRuleId) ?? null,
    [readinessRules, selectedRuleId]
  );

  const filteredMilestones = useMemo(
    () => filterMilestones(milestoneDefinitions, searchTerm),
    [milestoneDefinitions, searchTerm]
  );
  const filteredRules = useMemo(
    () => filterRules(readinessRules, searchTerm),
    [readinessRules, searchTerm]
  );
  const rulesByMilestoneKey = useMemo(
    () => groupRulesByMilestoneKey(readinessRules),
    [readinessRules]
  );

	  const saveMilestone = async (
	    input: SaveCampaignOperationMilestoneDefinitionInput
	  ): Promise<boolean> => {
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      if (selectedMilestone) {
        await updateMilestoneDefinition(selectedMilestone.id, input);
        setSuccessMessage('Milestone definition updated.');
      } else {
        const created = await createMilestoneDefinition(input);
        setSelectedMilestoneId(created.id);
        setSuccessMessage('Milestone definition created.');
	      }
	      await onDataChanged();
	      closeDrawer();
	      return true;
    } catch (saveError) {
      setErrorMessage(
        saveError instanceof Error ? saveError.message : 'Unable to save milestone definition.'
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const saveRule = async (input: SaveCampaignOperationReadinessRuleInput): Promise<boolean> => {
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      if (selectedRule) {
        await updateReadinessRule(selectedRule.id, input);
        setSuccessMessage('Readiness rule updated.');
      } else {
        const created = await createReadinessRule(input);
        setSelectedRuleId(created.id);
        setSuccessMessage('Readiness rule created.');
	      }
	      await onDataChanged();
	      closeDrawer();
	      return true;
    } catch (saveError) {
      setErrorMessage(saveError instanceof Error ? saveError.message : 'Unable to save readiness rule.');
      return false;
    } finally {
      setIsSaving(false);
	    }
	  };

  const openNewMilestone = () => {
    setSelectedMilestoneId(null);
    setSelectedTab('milestones');
    setDrawerMode('milestone');
  };

  const openMilestone = (id: string) => {
    setSelectedMilestoneId(id);
    setSelectedTab('milestones');
    setDrawerMode('milestone');
  };

  const openNewRule = () => {
    setSelectedRuleId(null);
    setSelectedTab('rules');
    setDrawerMode('rule');
  };

  const openRule = (id: string) => {
    setSelectedRuleId(id);
    setSelectedTab('rules');
    setDrawerMode('rule');
  };

  const closeDrawer = () => {
    setDrawerMode(null);
    setSelectedMilestoneId(null);
    setSelectedRuleId(null);
  };

  return (
    <div className="admin-campaign-ops">
      <div className="content-card admin-campaign-ops__header">
        <div>
          <h2 className="h5 mb-1">Campaign Operations</h2>
          <p className="text-muted mb-0">
            Configure the global campaign milestones and readiness rules used by Campaign Studio.
          </p>
        </div>
        <div className="admin-campaign-ops__stats">
          <span className="admin-campaign-ops-pill">
            <i className="bi bi-signpost-2" aria-hidden="true" />
            {milestoneDefinitions.length} milestones
          </span>
          <span className="admin-campaign-ops-pill">
            <i className="bi bi-clipboard-check" aria-hidden="true" />
            {readinessRules.length} rules
          </span>
        </div>
      </div>

      {successMessage ? (
        <AutoDismissAlert
          message={successMessage}
          onDismiss={() => setSuccessMessage(null)}
          variant="success"
        />
      ) : null}

      {errorMessage ? <div className="alert alert-danger">{errorMessage}</div> : null}

      <div className="content-card admin-campaign-ops__tabs" role="tablist" aria-label="Campaign operation sections">
        <button
          type="button"
          className={`admin-campaign-ops-tab ${selectedTab === 'milestones' ? 'is-active' : ''}`}
          onClick={() => setSelectedTab('milestones')}
        >
          <i className="bi bi-signpost-2" aria-hidden="true" />
          Milestone Definitions
        </button>
        <button
          type="button"
          className={`admin-campaign-ops-tab ${selectedTab === 'rules' ? 'is-active' : ''}`}
          onClick={() => setSelectedTab('rules')}
        >
          <i className="bi bi-ui-checks" aria-hidden="true" />
          Readiness Rules
        </button>
      </div>

      <div className="admin-campaign-ops__toolbar">
        <div className="admin-campaign-ops__search">
          <i className="bi bi-search" aria-hidden="true" />
          <input
            className="form-control"
            placeholder={selectedTab === 'milestones' ? 'Search milestones' : 'Search readiness rules'}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <button
          type="button"
	          className="btn btn-primary"
	          onClick={selectedTab === 'milestones' ? openNewMilestone : openNewRule}
	        >
          <i className="bi bi-plus-lg me-2" aria-hidden="true" />
          {selectedTab === 'milestones' ? 'New Milestone' : 'New Rule'}
        </button>
      </div>

      {selectedTab === 'milestones' ? (
        <div className="admin-campaign-ops__grid">
          <MilestoneDefinitionTable
            definitions={filteredMilestones}
	            rulesByMilestoneKey={rulesByMilestoneKey}
	            selectedId={selectedMilestoneId}
	            onSelect={openMilestone}
	          />
	        </div>
	      ) : (
	        <div className="admin-campaign-ops__grid admin-campaign-ops__grid--rules">
          <ReadinessRuleTable
	            rules={filteredRules}
	            selectedId={selectedRuleId}
	            onSelect={openRule}
	          />
	        </div>
	      )}

      <AdminWorkspaceDrawer
        isOpen={drawerMode === 'milestone'}
        title={selectedMilestone ? 'Edit Milestone Definition' : 'New Milestone Definition'}
        description="Milestone definitions control which date checkpoints Campaign Studio can schedule and validate."
        onClose={closeDrawer}
        width="wide"
      >
        <MilestoneDefinitionForm
          key={selectedMilestone?.id ?? 'new-milestone'}
          definition={selectedMilestone}
          referencedRules={
            selectedMilestone ? rulesByMilestoneKey.get(selectedMilestone.milestoneKey) ?? [] : []
          }
          featureAreas={options.featureAreas}
          isSaving={isSaving}
          onSave={saveMilestone}
          onCancel={closeDrawer}
        />
      </AdminWorkspaceDrawer>

      <AdminWorkspaceDrawer
        isOpen={drawerMode === 'rule'}
        title={selectedRule ? 'Edit Readiness Rule' : 'New Readiness Rule'}
        description="Readiness rules define campaign blockers and operational signals from configured milestones."
        onClose={closeDrawer}
        width="wide"
      >
        <ReadinessRuleForm
          key={selectedRule?.id ?? 'new-rule'}
          rule={selectedRule}
          options={options}
          isSaving={isSaving}
          onSave={saveRule}
          onCancel={closeDrawer}
        />
      </AdminWorkspaceDrawer>
	    </div>
	  );
	}

function MilestoneDefinitionTable({
  definitions,
  rulesByMilestoneKey,
  selectedId,
  onSelect,
}: {
  definitions: CampaignOperationMilestoneDefinition[];
  rulesByMilestoneKey: Map<string, CampaignOperationReadinessRule[]>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="content-card admin-campaign-ops-table-card">
      <div className="table-responsive">
        <table className="table admin-campaign-ops-table align-middle mb-0">
          <thead>
            <tr>
              <th>Milestone</th>
              <th>Area</th>
              <th>Rules</th>
              <th>Status</th>
              <th>Sort</th>
            </tr>
          </thead>
          <tbody>
            {definitions.map((definition) => (
              <tr
                key={definition.id}
                className={`admin-campaign-ops-action-row ${selectedId === definition.id ? 'is-selected' : ''}`}
                role="button"
                tabIndex={0}
                aria-label={`Edit milestone ${definition.label}`}
                onClick={() => onSelect(definition.id)}
                onKeyDown={(event) => handleActionRowKeyDown(event, () => onSelect(definition.id))}
              >
                <td>
                  <span className="admin-campaign-ops-row-button">
                    <span className="fw-semibold">{definition.label}</span>
                    <span className="text-muted small">{definition.milestoneKey}</span>
                  </span>
                </td>
                <td>{formatToken(definition.featureArea)}</td>
                <td>{rulesByMilestoneKey.get(definition.milestoneKey)?.length ?? 0}</td>
                <td>
                  <StatusBadge isActive={definition.isActive} />
                </td>
                <td>{definition.defaultSortOrder}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReadinessRuleTable({
  rules,
  selectedId,
  onSelect,
}: {
  rules: CampaignOperationReadinessRule[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="content-card admin-campaign-ops-table-card">
      <div className="table-responsive">
        <table className="table admin-campaign-ops-table align-middle mb-0">
          <thead>
            <tr>
              <th>Rule</th>
              <th>Milestone</th>
              <th>Severity</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr
                key={rule.id}
                className={`admin-campaign-ops-action-row ${selectedId === rule.id ? 'is-selected' : ''}`}
                role="button"
                tabIndex={0}
                aria-label={`Edit readiness rule ${rule.name}`}
                onClick={() => onSelect(rule.id)}
                onKeyDown={(event) => handleActionRowKeyDown(event, () => onSelect(rule.id))}
              >
                <td>
                  <span className="admin-campaign-ops-row-button">
                    <span className="fw-semibold">{rule.name}</span>
                    <span className="text-muted small">{rule.ruleKey}</span>
                  </span>
                </td>
                <td>{rule.milestoneKey}</td>
                <td>{formatToken(rule.severity)}</td>
                <td>
                  <StatusBadge isActive={rule.isActive} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function handleActionRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, onSelect: () => void) {
  if (event.key !== 'Enter' && event.key !== ' ') {
    return;
  }

  event.preventDefault();
  onSelect();
}

function MilestoneDefinitionForm({
  definition,
  referencedRules,
  featureAreas,
  isSaving,
  onSave,
  onCancel,
}: {
  definition: CampaignOperationMilestoneDefinition | null;
  referencedRules: CampaignOperationReadinessRule[];
  featureAreas: string[];
  isSaving: boolean;
  onSave: (input: SaveCampaignOperationMilestoneDefinitionInput) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [isActive, setIsActive] = useState(definition?.isActive ?? true);
  const [confirmedSystemDeactivate, setConfirmedSystemDeactivate] = useState(false);
  const requiresSystemDeactivateConfirmation =
    Boolean(definition?.isSystem && definition.isActive && !isActive);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await onSave({
      milestoneKey: definition ? undefined : readText(formData, 'milestoneKey'),
      label: readText(formData, 'label'),
      description: readOptionalText(formData, 'description'),
      featureArea: readText(formData, 'featureArea'),
      defaultSortOrder: Number(formData.get('defaultSortOrder') || 0),
      isActive,
    });
  };

	  return (
	    <form className="admin-campaign-ops-form" onSubmit={handleSubmit}>
	      <div>
	        <p className="text-muted small mb-0">
	          Milestone keys are global. Campaigns set actual dates in Campaign Studio.
        </p>
      </div>
      <div className="admin-campaign-ops-form__grid">
        <label className="form-label admin-campaign-ops-form__span-2">
          Key
          <input
            name="milestoneKey"
            className="form-control"
            defaultValue={definition?.milestoneKey ?? ''}
            disabled={definition !== null}
            required
          />
        </label>
        <label className="form-label admin-campaign-ops-form__span-2">
          Label
          <input name="label" className="form-control" defaultValue={definition?.label ?? ''} required />
        </label>
        <label className="form-label">
          Feature Area
          <select name="featureArea" className="form-select" defaultValue={definition?.featureArea ?? featureAreas[0] ?? 'GENERAL'}>
            {featureAreas.map((area) => (
              <option key={area} value={area}>
                {formatToken(area)}
              </option>
            ))}
          </select>
        </label>
        <label className="form-label">
          Sort Order
          <input
            name="defaultSortOrder"
            type="number"
            className="form-control"
            defaultValue={definition?.defaultSortOrder ?? 0}
          />
        </label>
        <label className="form-label admin-campaign-ops-form__span-2">
          Description
          <textarea
            name="description"
            className="form-control"
            rows={3}
            defaultValue={definition?.description ?? ''}
          />
        </label>
      </div>
      <label className="form-check form-switch">
        <input
          className="form-check-input"
          type="checkbox"
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
        />
        <span className="form-check-label">Active</span>
      </label>
      {referencedRules.length > 0 ? (
        <div className="admin-campaign-ops-reference-panel">
          <div className="fw-semibold mb-2">Referenced By</div>
          <div className="admin-campaign-ops-reference-list">
            {referencedRules.map((rule) => (
              <span key={rule.id} className="admin-campaign-ops-reference">
                <i className="bi bi-ui-checks" aria-hidden="true" />
                {rule.name}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {requiresSystemDeactivateConfirmation ? (
        <label className="admin-campaign-ops-confirm form-check">
          <input
            className="form-check-input"
            type="checkbox"
            checked={confirmedSystemDeactivate}
            onChange={(event) => setConfirmedSystemDeactivate(event.target.checked)}
          />
          <span className="form-check-label">
            Confirm deactivating this system milestone definition.
          </span>
        </label>
      ) : null}
	      <div className="admin-campaign-ops-form__actions">
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onCancel}>
          Cancel
        </button>
	        <button
	          type="submit"
          className="btn btn-secondary btn-sm"
          disabled={isSaving || (requiresSystemDeactivateConfirmation && !confirmedSystemDeactivate)}
        >
          <i className="bi bi-floppy me-2" aria-hidden="true" />
          {definition ? 'Save Milestone' : 'Create Milestone'}
        </button>
      </div>
    </form>
  );
}

function ReadinessRuleForm({
  rule,
  options,
  isSaving,
  onSave,
  onCancel,
}: {
  rule: CampaignOperationReadinessRule | null;
  options: CampaignOperationRuleOptions;
  isSaving: boolean;
  onSave: (input: SaveCampaignOperationReadinessRuleInput) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [conditionType, setConditionType] = useState(rule?.conditionType ?? 'ALWAYS');
  const [blockingFor, setBlockingFor] = useState<string[]>(rule?.blockingFor ?? []);
  const [isActive, setIsActive] = useState(rule?.isActive ?? true);
  const [milestoneKey, setMilestoneKey] = useState(rule?.milestoneKey ?? options.milestoneDefinitions[0]?.milestoneKey ?? '');
  const [severity, setSeverity] = useState(rule?.severity ?? 'warning');
  const [category, setCategory] = useState(rule?.category ?? 'planning_gaps');
  const [section, setSection] = useState(rule?.section ?? 'schedule');
  const [confirmedSystemDeactivate, setConfirmedSystemDeactivate] = useState(false);
  const requiresSystemDeactivateConfirmation = Boolean(rule?.isSystem && rule.isActive && !isActive);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await onSave({
      ruleKey: rule ? undefined : readText(formData, 'ruleKey'),
      name: readText(formData, 'name'),
      description: readOptionalText(formData, 'description'),
      ruleType: readText(formData, 'ruleType'),
      featureArea: readText(formData, 'featureArea'),
      conditionType,
      conditionConfig: buildConditionConfig(conditionType, formData),
      milestoneKey,
      severity,
      category,
      blockingFor,
      section,
      actionLabel: readOptionalText(formData, 'actionLabel'),
      message: readText(formData, 'message'),
      isActive,
    });
  };

	  return (
	    <form className="admin-campaign-ops-form" onSubmit={handleSubmit}>
	      <div>
	        <p className="text-muted small mb-0">
	          Rules currently evaluate missing milestone dates with constrained conditions.
        </p>
      </div>
      <div className="admin-campaign-ops-form__grid">
        <label className="form-label admin-campaign-ops-form__span-2">
          Rule Key
          <input
            name="ruleKey"
            className="form-control"
            defaultValue={rule?.ruleKey ?? ''}
            disabled={rule !== null}
            required
          />
        </label>
        <label className="form-label admin-campaign-ops-form__span-2">
          Name
          <input name="name" className="form-control" defaultValue={rule?.name ?? ''} required />
        </label>
        <label className="form-label">
          Rule Type
          <select name="ruleType" className="form-select" defaultValue={rule?.ruleType ?? 'MISSING_MILESTONE'}>
            {options.ruleTypes.map((ruleType) => (
              <option key={ruleType} value={ruleType}>
                {formatToken(ruleType)}
              </option>
            ))}
          </select>
        </label>
        <label className="form-label">
          Feature Area
          <select name="featureArea" className="form-select" defaultValue={rule?.featureArea ?? options.featureAreas[0] ?? 'GENERAL'}>
            {options.featureAreas.map((area) => (
              <option key={area} value={area}>
                {formatToken(area)}
              </option>
            ))}
          </select>
        </label>
        <label className="form-label admin-campaign-ops-form__span-2">
          Milestone
          <select
            name="milestoneKey"
            className="form-select"
            value={milestoneKey}
            onChange={(event) => setMilestoneKey(event.target.value)}
          >
            {options.milestoneDefinitions.map((definition) => (
              <option key={definition.milestoneKey} value={definition.milestoneKey}>
                {definition.label}
              </option>
            ))}
          </select>
        </label>
        <label className="form-label">
          Condition
          <select
            name="conditionType"
            className="form-select"
            value={conditionType}
            onChange={(event) => setConditionType(event.target.value)}
          >
            {options.conditionTypes.map((type) => (
              <option key={type} value={type}>
                {formatToken(type)}
              </option>
            ))}
          </select>
        </label>
        <ConditionConfigField
          conditionType={conditionType}
          options={options}
          config={rule?.conditionConfig ?? null}
        />
        <label className="form-label">
          Severity
          <select
            name="severity"
            className="form-select"
            value={severity}
            onChange={(event) => setSeverity(event.target.value)}
          >
            {options.severities.map((severity) => (
              <option key={severity} value={severity}>
                {formatToken(severity)}
              </option>
            ))}
          </select>
        </label>
        <label className="form-label">
          Category
          <select
            name="category"
            className="form-select"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {options.categories.map((category) => (
              <option key={category} value={category}>
                {formatToken(category)}
              </option>
            ))}
          </select>
        </label>
        <label className="form-label">
          Section
          <select
            name="section"
            className="form-select"
            value={section}
            onChange={(event) => setSection(event.target.value)}
          >
            {options.sections.map((section) => (
              <option key={section} value={section}>
                {formatToken(section)}
              </option>
            ))}
          </select>
        </label>
        <label className="form-label">
          Action Label
          <input name="actionLabel" className="form-control" defaultValue={rule?.actionLabel ?? 'Open Schedule'} />
        </label>
        <fieldset className="admin-campaign-ops-form__span-2 admin-campaign-ops-phase-set">
          <legend>Blocking Phases</legend>
          {options.phases.map((phase) => (
            <label key={phase} className="form-check">
              <input
                className="form-check-input"
                type="checkbox"
                checked={blockingFor.includes(phase)}
                onChange={(event) =>
                  setBlockingFor((currentValue) =>
                    event.target.checked
                      ? [...currentValue, phase]
                      : currentValue.filter((item) => item !== phase)
                  )
                }
              />
              <span className="form-check-label">{formatToken(phase)}</span>
            </label>
          ))}
        </fieldset>
        <label className="form-label admin-campaign-ops-form__span-2">
          Message
          <textarea name="message" className="form-control" rows={3} defaultValue={rule?.message ?? ''} required />
        </label>
        <label className="form-label admin-campaign-ops-form__span-2">
          Description
          <textarea
            name="description"
            className="form-control"
            rows={2}
            defaultValue={rule?.description ?? ''}
          />
        </label>
      </div>
      <label className="form-check form-switch">
        <input
          className="form-check-input"
          type="checkbox"
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
        />
        <span className="form-check-label">Active</span>
      </label>
      <RuleImpactPreview
        milestoneLabel={
          options.milestoneDefinitions.find((definition) => definition.milestoneKey === milestoneKey)?.label ??
          milestoneKey
        }
        severity={severity}
        category={category}
        section={section}
        conditionType={conditionType}
        blockingFor={blockingFor}
      />
      {requiresSystemDeactivateConfirmation ? (
        <label className="admin-campaign-ops-confirm form-check">
          <input
            className="form-check-input"
            type="checkbox"
            checked={confirmedSystemDeactivate}
            onChange={(event) => setConfirmedSystemDeactivate(event.target.checked)}
          />
          <span className="form-check-label">
            Confirm deactivating this system readiness rule.
          </span>
        </label>
      ) : null}
	      <div className="admin-campaign-ops-form__actions">
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onCancel}>
          Cancel
        </button>
	        <button
	          type="submit"
          className="btn btn-secondary btn-sm"
          disabled={isSaving || (requiresSystemDeactivateConfirmation && !confirmedSystemDeactivate)}
        >
          <i className="bi bi-floppy me-2" aria-hidden="true" />
          {rule ? 'Save Rule' : 'Create Rule'}
        </button>
      </div>
    </form>
  );
}

function RuleImpactPreview({
  milestoneLabel,
  severity,
  category,
  section,
  conditionType,
  blockingFor,
}: {
  milestoneLabel: string;
  severity: string;
  category: string;
  section: string;
  conditionType: string;
  blockingFor: string[];
}) {
  return (
    <div className="admin-campaign-ops-impact" aria-label="Rule impact preview">
      <div className="fw-semibold">Rule Impact</div>
      <div className="admin-campaign-ops-impact__body">
        <span>
          Missing <strong>{milestoneLabel}</strong> emits a{' '}
          <strong>{formatToken(severity)}</strong> readiness item in{' '}
          <strong>{formatToken(category)}</strong>.
        </span>
        <span>
          It opens <strong>{formatToken(section)}</strong> and applies when{' '}
          <strong>{formatToken(conditionType)}</strong>
          {blockingFor.length > 0
            ? `; blocks ${blockingFor.map(formatToken).join(', ')}.`
            : '; does not block lifecycle phases.'}
        </span>
      </div>
    </div>
  );
}

function ConditionConfigField({
  conditionType,
  options,
  config,
}: {
  conditionType: string;
  options: CampaignOperationRuleOptions;
  config: Record<string, unknown> | null;
}) {
  if (conditionType === 'CAMPAIGN_FIELD_TRUE') {
    return (
      <label className="form-label">
        Campaign Field
        <select name="conditionField" className="form-select" defaultValue={String(config?.field ?? options.allowedCampaignFields[0] ?? '')}>
          {options.allowedCampaignFields.map((field) => (
            <option key={field} value={field}>
              {field}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if (conditionType === 'CAMPAIGN_STATUS_IS') {
    return (
      <label className="form-label">
        Campaign Status
        <select name="conditionStatus" className="form-select" defaultValue={String(config?.status ?? 'ACTIVE')}>
          {['DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED'].map((status) => (
            <option key={status} value={status}>
              {formatToken(status)}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if (conditionType === 'FEATURE_ENABLED') {
    return (
      <label className="form-label">
        Feature Key
        <input name="conditionFeatureKey" className="form-control" defaultValue={String(config?.feature_key ?? '')} />
      </label>
    );
  }
  return (
    <div className="admin-campaign-ops-condition-static">
      <span className="text-muted small">Always applies</span>
    </div>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span className={`admin-campaign-ops-status ${isActive ? 'is-active' : 'is-inactive'}`}>
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
}

function buildConditionConfig(conditionType: string, formData: FormData): Record<string, unknown> | null {
  if (conditionType === 'CAMPAIGN_FIELD_TRUE') {
    return { field: readText(formData, 'conditionField') };
  }
  if (conditionType === 'CAMPAIGN_STATUS_IS') {
    return { status: readText(formData, 'conditionStatus') };
  }
  if (conditionType === 'FEATURE_ENABLED') {
    return { feature_key: readText(formData, 'conditionFeatureKey') };
  }
  return null;
}

function filterMilestones(
  definitions: CampaignOperationMilestoneDefinition[],
  searchTerm: string
) {
  const normalized = searchTerm.trim().toLowerCase();
  if (!normalized) {
    return definitions;
  }
  return definitions.filter((definition) =>
    [definition.milestoneKey, definition.label, definition.featureArea]
      .join(' ')
      .toLowerCase()
      .includes(normalized)
  );
}

function filterRules(rules: CampaignOperationReadinessRule[], searchTerm: string) {
  const normalized = searchTerm.trim().toLowerCase();
  if (!normalized) {
    return rules;
  }
  return rules.filter((rule) =>
    [rule.ruleKey, rule.name, rule.milestoneKey, rule.category, rule.severity]
      .join(' ')
      .toLowerCase()
      .includes(normalized)
  );
}

function groupRulesByMilestoneKey(rules: CampaignOperationReadinessRule[]) {
  return rules.reduce<Map<string, CampaignOperationReadinessRule[]>>((groupedRules, rule) => {
    const nextRules = groupedRules.get(rule.milestoneKey) ?? [];
    nextRules.push(rule);
    groupedRules.set(rule.milestoneKey, nextRules);
    return groupedRules;
  }, new Map());
}

function readText(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

function readOptionalText(formData: FormData, key: string): string | null {
  const value = readText(formData, key);
  return value || null;
}

function formatToken(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}
