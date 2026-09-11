import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import {
  ActionItem,
  CreateRetroPayload,
  CreateTemplatePayload,
  JoinRetroResponse,
  RetroBoard,
  RetroReport,
  TeamDetail,
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

  createTeam(name: string) {
    return this.http.post<TeamDetail>(`${this.base}/teams`, { name });
  }

  joinTeam(inviteCode: string) {
    return this.http.post<TeamDetail>(`${this.base}/teams/join`, { inviteCode });
  }

  getTeam(id: string) {
    return this.http.get<TeamDetail>(`${this.base}/teams/${id}`);
  }

  removeTeamMember(teamId: string, userId: string) {
    return this.http.delete<{ removed: boolean; accountDeleted: boolean }>(
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

  advancePhase(id: string, status: string) {
    return this.http.post(`${this.base}/retros/${id}/phase`, { status });
  }

  setCommentsReady(id: string, ready: boolean) {
    return this.http.patch<{ commentsReady?: boolean; votesReady?: boolean }>(
      `${this.base}/retros/${id}/me/ready`,
      { ready },
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

  groupCards(id: string, sourceCardId: string, targetCardId: string) {
    return this.http.post(`${this.base}/retros/${id}/group`, {
      sourceCardId,
      targetCardId,
    });
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

  stopTimer(id: string) {
    return this.http.post(`${this.base}/retros/${id}/timer/stop`, {});
  }

  submitRoti(id: string, score: number, comment?: string) {
    return this.http.post(`${this.base}/retros/${id}/roti`, { score, comment });
  }

  getReport(id: string) {
    return this.http.get<RetroReport>(`${this.base}/retros/${id}/report`);
  }

  createRetroAction(
    id: string,
    body: { title: string; description?: string; ownerId?: string },
  ) {
    return this.http.post(`${this.base}/retros/${id}/actions`, body);
  }

  deleteRetro(id: string) {
    return this.http.delete<{ deleted: boolean }>(`${this.base}/retros/${id}`);
  }

  // Actions board
  listActions(teamId: string) {
    return this.http.get<ActionItem[]>(`${this.base}/teams/${teamId}/actions`);
  }

  createAction(
    teamId: string,
    body: { title: string; description?: string; ownerId?: string },
  ) {
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
}
