import { useCallback, useEffect, useState } from 'react';
import {
  addCampaignTeamMember,
  createCampaignMember,
  createCampaignMemberAccessRole,
  createCampaignTeam,
  createCampaignTeamRole,
  getCampaignTeamWorkspace,
  inviteCampaignMemberAppAccess,
  linkCampaignMemberAppUser,
  removeCampaignMemberAppAccess,
  removeCampaignTeamMember,
  updateCampaignMember,
  updateCampaignMemberAccessRole,
  updateCampaignTeam,
  updateCampaignTeamMemberRole,
  updateCampaignTeamRole,
} from '@/features/campaigns/api/campaignTeamWorkspaceApi';
import type {
  CampaignMemberAccessRoleUpsertInput,
  CampaignMemberAppInviteInput,
  CampaignMemberAppLinkInput,
  CampaignTeamMemberUpsertInput,
  CampaignTeamRoleUpsertInput,
  CampaignTeamUpsertInput,
  CampaignTeamWorkspaceData,
  CampaignTeamWorkspaceMember,
  CampaignTeamWorkspaceTeam,
} from '@/features/campaigns/model/campaignTeamWorkspaceTypes';

interface CampaignTeamWorkspaceState {
  workspace: CampaignTeamWorkspaceData | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  saveMessage: string | null;
}

const emptyState: CampaignTeamWorkspaceState = {
  workspace: null,
  isLoading: false,
  isSaving: false,
  error: null,
  saveMessage: null,
};

export function useCampaignTeamWorkspace(campaignId: string) {
  const [state, setState] = useState<CampaignTeamWorkspaceState>(emptyState);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setState((currentState) => ({
        ...currentState,
        isLoading: true,
        error: null,
      }));

      try {
        const workspace = await getCampaignTeamWorkspace(campaignId);
        if (cancelled) {
          return;
        }
        setState({
          workspace,
          isLoading: false,
          isSaving: false,
          error: null,
          saveMessage: null,
        });
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setState({
          workspace: null,
          isLoading: false,
          isSaving: false,
          error: toErrorMessage(loadError, 'Unable to load team workspace'),
          saveMessage: null,
        });
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  const reload = useCallback(async () => {
    setState((currentState) => ({
      ...currentState,
      isLoading: true,
      error: null,
    }));

    try {
      const workspace = await getCampaignTeamWorkspace(campaignId);
      setState((currentState) => ({
        ...currentState,
        workspace,
        isLoading: false,
      }));
      return workspace;
    } catch (reloadError) {
      setState((currentState) => ({
        ...currentState,
        isLoading: false,
        error: toErrorMessage(reloadError, 'Unable to refresh team workspace'),
      }));
      return null;
    }
  }, [campaignId]);

  const saveMember = async (
    input: CampaignTeamMemberUpsertInput,
    memberId?: string
  ): Promise<CampaignTeamWorkspaceMember | null> =>
    performMutationResult(
      () =>
        memberId
          ? updateCampaignMember(campaignId, memberId, input)
          : createCampaignMember(campaignId, input),
      memberId ? 'Person updated.' : 'Person added.'
    );

  const saveAccessRole = async (
    memberId: string,
    input: CampaignMemberAccessRoleUpsertInput,
    assignmentId?: string
  ) =>
    performMutation(
      () =>
        assignmentId
          ? updateCampaignMemberAccessRole(campaignId, memberId, assignmentId, input)
          : createCampaignMemberAccessRole(campaignId, memberId, input),
      assignmentId ? 'Access role updated.' : 'Access role added.'
    );

  const saveTeam = async (
    input: CampaignTeamUpsertInput,
    teamId?: string
  ): Promise<CampaignTeamWorkspaceTeam | null> =>
    performMutationResult(
      () =>
        teamId
          ? updateCampaignTeam(campaignId, teamId, input)
          : createCampaignTeam(campaignId, input),
      teamId ? 'Team updated.' : 'Team added.'
    );

  const saveTeamRole = async (
    teamId: string,
    input: CampaignTeamRoleUpsertInput,
    roleId?: string
  ) =>
    performMutation(
      () =>
        roleId
          ? updateCampaignTeamRole(campaignId, teamId, roleId, input)
          : createCampaignTeamRole(campaignId, teamId, input),
      roleId ? 'Team role updated.' : 'Team role added.'
    );

  const addMemberToTeam = async (
    teamId: string,
    memberId: string,
    teamRoleId?: string | null
  ) =>
    performMutation(
      () => addCampaignTeamMember(campaignId, teamId, memberId, teamRoleId),
      'Team member added.'
    );

  const updateMemberTeamRole = async (
    teamId: string,
    memberId: string,
    teamRoleId: string | null
  ) =>
    performMutation(
      () => updateCampaignTeamMemberRole(campaignId, teamId, memberId, teamRoleId),
      'Team role updated.'
    );

  const removeMemberFromTeam = async (teamId: string, memberId: string) =>
    performMutation(
      () => removeCampaignTeamMember(campaignId, teamId, memberId),
      'Team member removed.'
    );

  const linkAppUser = async (
    memberId: string,
    input: CampaignMemberAppLinkInput
  ): Promise<CampaignTeamWorkspaceMember | null> =>
    performMutationResult(
      () => linkCampaignMemberAppUser(campaignId, memberId, input),
      'App access linked.'
    );

  const inviteAppAccess = async (
    memberId: string,
    input: CampaignMemberAppInviteInput
  ): Promise<CampaignTeamWorkspaceMember | null> =>
    performMutationResult(
      () => inviteCampaignMemberAppAccess(campaignId, memberId, input),
      'App access invite prepared.'
    );

  const removeAppAccess = async (memberId: string): Promise<CampaignTeamWorkspaceMember | null> =>
    performMutationResult(
      () => removeCampaignMemberAppAccess(campaignId, memberId),
      'App access removed.'
    );

  const clearSaveMessage = () => {
    setState((currentState) => ({
      ...currentState,
      saveMessage: null,
    }));
  };

  const clearError = () => {
    setState((currentState) => ({
      ...currentState,
      error: null,
    }));
  };

  const performMutation = async (
    mutate: () => Promise<unknown>,
    successMessage: string
  ) => {
    setState((currentState) => ({
      ...currentState,
      isSaving: true,
      error: null,
      saveMessage: null,
    }));

    try {
      await mutate();
      const workspace = await getCampaignTeamWorkspace(campaignId);
      setState({
        workspace,
        isLoading: false,
        isSaving: false,
        error: null,
        saveMessage: successMessage,
      });
      return true;
    } catch (mutationError) {
      setState((currentState) => ({
        ...currentState,
        isSaving: false,
        error: toErrorMessage(mutationError, 'Unable to save team changes'),
        saveMessage: null,
      }));
      return false;
    }
  };

  const performMutationResult = async <T,>(
    mutate: () => Promise<T>,
    successMessage: string
  ): Promise<T | null> => {
    setState((currentState) => ({
      ...currentState,
      isSaving: true,
      error: null,
      saveMessage: null,
    }));

    try {
      const result = await mutate();
      const workspace = await getCampaignTeamWorkspace(campaignId);
      setState({
        workspace,
        isLoading: false,
        isSaving: false,
        error: null,
        saveMessage: successMessage,
      });
      return result;
    } catch (mutationError) {
      setState((currentState) => ({
        ...currentState,
        isSaving: false,
        error: toErrorMessage(mutationError, 'Unable to save team changes'),
        saveMessage: null,
      }));
      return null;
    }
  };

  return {
    ...state,
    reload,
    saveMember,
    saveAccessRole,
    saveTeam,
    saveTeamRole,
    addMemberToTeam,
    updateMemberTeamRole,
    removeMemberFromTeam,
    linkAppUser,
    inviteAppAccess,
    removeAppAccess,
    clearSaveMessage,
    clearError,
  };
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}
