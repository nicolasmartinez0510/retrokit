import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import {
  ActionItem,
  ActionItemWrite,
  ActionProgressUpdate,
  ActionProgressWrite,
  CreateRetroPayload,
  CreateTemplatePayload,
  JoinRetroResponse,
  OutgoingTeamInvite,
  Phase,
  RetroBoard,
  RetroReport,
  TeamDetail,
  TeamInvite,
  TeamJoinRequest,
  TeamSummary,
  Template,
  UpdateTemplatePayload,
} from './models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  // Teams
  listTeams() {
    return this.http.get<TeamSummary[]>(`${this.base}/teams`);
  }

  createTeam(name: string, inviteEmails?: string[]) {
    return this.http.post<TeamDetail>(`${this.base}/teams`, {
      name,
      ...(inviteEmails?.length ? { inviteEmails } : {}),
    });
  }

  updateTeam(id: string, payload: { name?: string }) {
    return this.http.patch<TeamDetail>(`${this.base}/teams/${id}`, payload);
  }

  uploadTeamLogo(id: string, file: File) {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<TeamDetail>(`${this.base}/teams/${id}/logo`, form);
  }

  deleteTeamLogo(id: string) {
    return this.http.delete<TeamDetail>(`${this.base}/teams/${id}/logo`);
  }

  searchUsersByEmail(email: string) {
    return this.http.get<
      { id: string; name: string; email: string; avatarId?: string | null }[]
    >(`${this.base}/users/search`, { params: { email } });
  }

  listUsers() {
    return this.http.get<
      {
        id: string;
        email: string;
        name: string;
        avatarId?: string | null;
        isAdmin: boolean;
        createdAt: string;
      }[]
    >(`${this.base}/users`);
  }

  deleteUser(id: string) {
    return this.http.delete<{ deleted: boolean }>(`${this.base}/users/${id}`);
  }

  inviteTeamMember(teamId: string, email: string) {
    return this.http.post<TeamInvite>(`${this.base}/teams/${teamId}/invites`, {
      email,
    });
  }

  listOutgoingTeamInvites(teamId: string) {
    return this.http.get<OutgoingTeamInvite[]>(
      `${this.base}/teams/${teamId}/invites`,
    );
  }

  cancelTeamInvite(teamId: string, inviteId: string) {
    return this.http.delete<{ cancelled: boolean; teamId: string; teamName: string }>(
      `${this.base}/teams/${teamId}/invites/${inviteId}`,
    );
  }

  listIncomingTeamInvites() {
    return this.http.get<TeamInvite[]>(`${this.base}/teams/invites/incoming`);
  }

  acceptTeamInvite(inviteId: string) {
    return this.http.post<{ accepted: boolean; teamId: string; teamName: string }>(
      `${this.base}/teams/invites/${inviteId}/accept`,
      {},
    );
  }

  rejectTeamInvite(inviteId: string) {
    return this.http.post<{ rejected: boolean; teamId: string; teamName: string }>(
      `${this.base}/teams/invites/${inviteId}/reject`,
      {},
    );
  }

  joinTeam(inviteCode: string) {
    return this.http.post<TeamDetail>(`${this.base}/teams/join`, { inviteCode });
  }

  getTeam(id: string) {
    return this.http.get<TeamDetail>(`${this.base}/teams/${id}`);
  }

  setTeamFavorite(id: string, favorited: boolean) {
    return this.http.patch<{
      id: string;
      name: string;
      favorited: boolean;
      favoritedAt: string | null;
    }>(`${this.base}/teams/${id}/favorite`, { favorited });
  }

  removeTeamMember(teamId: string, userId: string) {
    return this.http.delete<{ removed: boolean }>(
      `${this.base}/teams/${teamId}/members/${userId}`,
    );
  }

  deleteTeam(id: string) {
    return this.http.delete<{ deleted: boolean }>(`${this.base}/teams/${id}`);
  }

  requestTeamJoin(retroId: string) {
    return this.http.post<TeamJoinRequest>(`${this.base}/teams/join-requests`, {
      retroId,
    });
  }

  acceptJoinRequest(teamId: string, requestId: string) {
    return this.http.post<{ accepted: boolean }>(
      `${this.base}/teams/${teamId}/join-requests/${requestId}/accept`,
      {},
    );
  }

  rejectJoinRequest(teamId: string, requestId: string) {
    return this.http.post<{ rejected: boolean }>(
      `${this.base}/teams/${teamId}/join-requests/${requestId}/reject`,
      {},
    );
  }

  // Templates
  listTemplates() {
    return this.http.get<Template[]>(`${this.base}/templates`);
  }

  getTemplate(id: string) {
    return this.http.get<Template>(`${this.base}/templates/${id}`);
  }

  createTemplate(payload: CreateTemplatePayload) {
    return this.http.post<Template>(`${this.base}/templates`, payload);
  }

  updateTemplate(id: string, payload: UpdateTemplatePayload) {
    return this.http.patch<Template>(`${this.base}/templates/${id}`, payload);
  }

  deleteTemplate(id: string) {
    return this.http.delete<{ deleted: boolean }>(
      `${this.base}/templates/${id}`,
    );
  }

  uploadTemplateBackground(id: string, file: File) {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<Template>(
      `${this.base}/templates/${id}/background`,
      form,
    );
  }

  deleteTemplateBackground(id: string) {
    return this.http.delete<Template>(`${this.base}/templates/${id}/background`);
  }

  uploadColumnLogo(templateId: string, columnId: string, file: File) {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<Template>(
      `${this.base}/templates/${templateId}/columns/${columnId}/logo`,
      form,
    );
  }

  deleteColumnLogo(templateId: string, columnId: string) {
    return this.http.delete<Template>(
      `${this.base}/templates/${templateId}/columns/${columnId}/logo`,
    );
  }

  uploadStagingBackground(sessionId: string, file: File) {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('sessionId', sessionId);
    return this.http.post<{ url: string }>(
      `${this.base}/templates/staging/background`,
      form,
    );
  }

  uploadStagingLogo(sessionId: string, file: File) {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('sessionId', sessionId);
    return this.http.post<{ url: string }>(
      `${this.base}/templates/staging/logo`,
      form,
    );
  }

  deleteStaging(url: string) {
    return this.http.delete<{ deleted: boolean }>(
      `${this.base}/templates/staging`,
      { params: { url } },
    );
  }

  deleteStagingSession(sessionId: string) {
    return this.http.delete<{ deleted: boolean }>(
      `${this.base}/templates/staging/sessions/${sessionId}`,
    );
  }

  // Phases catalog
  listPhases() {
    return this.http.get<Phase[]>(`${this.base}/phases`);
  }

  getPhase(id: string) {
    return this.http.get<Phase>(`${this.base}/phases/${id}`);
  }

  createPhase(payload: Partial<Phase> & { name: string; kind: string }) {
    return this.http.post<Phase>(`${this.base}/phases`, payload);
  }

  updatePhase(id: string, payload: Partial<Phase>) {
    return this.http.patch<Phase>(`${this.base}/phases/${id}`, payload);
  }

  duplicatePhase(id: string) {
    return this.http.post<Phase>(`${this.base}/phases/${id}/duplicate`, {});
  }

  deletePhase(id: string, force = false) {
    return this.http.delete<{ ok: boolean }>(`${this.base}/phases/${id}`, {
      params: force ? { force: '1' } : {},
    });
  }

  // Retros
  createRetro(payload: CreateRetroPayload) {
    return this.http.post<RetroBoard & { openActionsReminder?: number }>(
      `${this.base}/retros`,
      payload,
    );
  }

  joinRetro(code: string, guestName?: string, avatarId?: string) {
    return this.http.post<JoinRetroResponse>(`${this.base}/retros/join`, {
      code,
      guestName,
      avatarId,
    });
  }

  joinRetroById(id: string) {
    return this.http.post<JoinRetroResponse>(`${this.base}/retros/${id}/join`, {});
  }

  getRetro(id: string) {
    return this.http.get<RetroBoard>(`${this.base}/retros/${id}`);
  }

  updateSettings(id: string, settings: Record<string, unknown>) {
    return this.http.patch(`${this.base}/retros/${id}/settings`, settings);
  }

  renameRetro(id: string, title: string) {
    return this.http.patch(`${this.base}/retros/${id}/settings`, { title });
  }

  advancePhase(id: string, phaseId: string) {
    return this.http.post(`${this.base}/retros/${id}/phase`, { phaseId });
  }

  setPresenter(id: string, cardId: string | null) {
    return this.http.post<{ presenterCardId: string | null }>(
      `${this.base}/retros/${id}/presenter`,
      { cardId },
    );
  }

  setCommentsReady(id: string, ready: boolean) {
    return this.http.patch<{
      commentsReady?: boolean;
      votesReady?: boolean;
      semaforoReady?: boolean;
    }>(`${this.base}/retros/${id}/me/ready`, { ready });
  }

  toggleReaction(id: string, cardId: string, emoji: string) {
    return this.http.post(`${this.base}/retros/${id}/reactions`, {
      cardId,
      emoji,
    });
  }

  setSemaforoVote(
    id: string,
    itemId: string,
    value: 'red' | 'yellow' | 'green' | null,
  ) {
    return this.http.post(`${this.base}/retros/${id}/semaforo/votes`, {
      itemId,
      value,
    });
  }

  setSemaforoNote(id: string, itemId: string, note: string | null) {
    return this.http.patch(
      `${this.base}/retros/${id}/semaforo/items/${itemId}`,
      { note },
    );
  }

  createCard(
    id: string,
    body: {
      columnId: string;
      content: string;
      isAnonymous?: boolean;
      image?: File | null;
    },
  ) {
    const form = new FormData();
    form.append('columnId', body.columnId);
    form.append('content', body.content ?? '');
    if (body.isAnonymous !== undefined) {
      form.append('isAnonymous', String(body.isAnonymous));
    }
    if (body.image) {
      form.append('image', body.image, body.image.name);
    }
    return this.http.post(`${this.base}/retros/${id}/cards`, form);
  }

  updateCard(
    id: string,
    cardId: string,
    body: { content?: string; columnId?: string; isAnonymous?: boolean },
  ) {
    return this.http.patch(`${this.base}/retros/${id}/cards/${cardId}`, body);
  }

  uploadCardImage(id: string, cardId: string, image: File) {
    const form = new FormData();
    form.append('image', image, image.name);
    return this.http.post(
      `${this.base}/retros/${id}/cards/${cardId}/image`,
      form,
    );
  }

  deleteCardImage(id: string, cardId: string) {
    return this.http.delete(`${this.base}/retros/${id}/cards/${cardId}/image`);
  }

  deleteCard(id: string, cardId: string) {
    return this.http.delete(`${this.base}/retros/${id}/cards/${cardId}`);
  }

  groupCards(
    id: string,
    sourceCardId: string,
    targetCardId: string,
    opts?: { moveGroup?: boolean },
  ) {
    return this.http.post(`${this.base}/retros/${id}/group`, {
      sourceCardId,
      targetCardId,
      ...(opts?.moveGroup ? { moveGroup: true } : {}),
    });
  }

  ungroupCards(
    id: string,
    body: { cardId: string; columnId?: string; ungroupAll?: boolean },
  ) {
    return this.http.post(`${this.base}/retros/${id}/ungroup`, body);
  }

  vote(
    id: string,
    body: { cardId?: string; groupId?: string; count: number },
  ) {
    return this.http.post(`${this.base}/retros/${id}/votes`, body);
  }

  startTimer(id: string, seconds?: number) {
    return this.http.post(`${this.base}/retros/${id}/timer/start`, { seconds });
  }

  pauseTimer(id: string) {
    return this.http.post(`${this.base}/retros/${id}/timer/pause`, {});
  }

  resumeTimer(id: string) {
    return this.http.post(`${this.base}/retros/${id}/timer/resume`, {});
  }

  addTimerSeconds(id: string, seconds = 60) {
    return this.http.post(`${this.base}/retros/${id}/timer/add`, { seconds });
  }

  stopTimer(id: string) {
    return this.http.post(`${this.base}/retros/${id}/timer/stop`, {});
  }

  submitRoti(id: string, score: number, comment?: string) {
    return this.http.post(`${this.base}/retros/${id}/roti`, { score, comment });
  }

  getReport(id: string) {
    return this.http.get<RetroReport>(`${this.base}/retros/${id}/report`);
  }

  createRetroAction(id: string, body: ActionItemWrite) {
    return this.http.post(`${this.base}/retros/${id}/actions`, body);
  }

  deleteRetro(id: string) {
    return this.http.delete<{ deleted: boolean }>(`${this.base}/retros/${id}`);
  }

  // Actions board
  listActions(teamId: string) {
    return this.http.get<ActionItem[]>(`${this.base}/teams/${teamId}/actions`);
  }

  createAction(teamId: string, body: ActionItemWrite) {
    return this.http.post(`${this.base}/teams/${teamId}/actions`, body);
  }

  updateAction(
    teamId: string,
    actionId: string,
    body: Partial<ActionItem>,
  ) {
    return this.http.patch(
      `${this.base}/teams/${teamId}/actions/${actionId}`,
      body,
    );
  }

  deleteAction(actionId: string) {
    return this.http.delete<{ deleted: boolean }>(
      `${this.base}/actions/${actionId}`,
    );
  }

  // Action progress updates
  listActionProgress(actionId: string) {
    return this.http.get<ActionProgressUpdate[]>(
      `${this.base}/actions/${actionId}/progress`,
    );
  }

  createActionProgress(actionId: string, body: ActionProgressWrite) {
    return this.http.post<ActionProgressUpdate>(
      `${this.base}/actions/${actionId}/progress`,
      body,
    );
  }

  updateActionProgress(updateId: string, body: ActionProgressWrite) {
    return this.http.patch<ActionProgressUpdate>(
      `${this.base}/action-progress/${updateId}`,
      body,
    );
  }

  deleteActionProgress(updateId: string) {
    return this.http.delete<{ deleted: boolean }>(
      `${this.base}/action-progress/${updateId}`,
    );
  }
}
