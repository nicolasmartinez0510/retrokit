import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { ActiveTeamService } from './active-team.service';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { TeamInvite } from './models';
import { SocketService } from './socket.service';
import { ToastService } from './toast.service';

@Injectable({ providedIn: 'root' })
export class TeamInviteService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly activeTeams = inject(ActiveTeamService);
  private readonly sockets = inject(SocketService);
  private readonly toast = inject(ToastService);

  readonly incoming = signal<TeamInvite | null>(null);
  readonly resolving = signal(false);
  readonly changed = signal(0);

  private queue: TeamInvite[] = [];
  private bound = false;

  private readonly onInvite = (payload: unknown) => {
    const invite = parseInvite(payload);
    if (!invite) return;
    if (this.incoming()?.id === invite.id) return;
    if (this.queue.some((item) => item.id === invite.id)) return;
    if (this.incoming()) {
      this.queue.push(invite);
      return;
    }
    this.incoming.set(invite);
  };

  private readonly onResolved = (payload: unknown) => {
    const id = readString(payload, 'id');
    if (id) this.dismiss(id);
    this.bump();
  };

  constructor() {
    effect(() => {
      const isUser = this.auth.isUser();
      this.auth.token();
      untracked(() => {
        if (isUser) {
          this.detach(false);
          this.attach();
          this.refreshIncoming();
        } else {
          this.detach(true);
        }
      });
    });
  }

  refreshIncoming() {
    this.api.listIncomingTeamInvites().subscribe({
      next: (invites) => {
        if (!invites.length) return;
        const currentId = this.incoming()?.id;
        const queuedIds = new Set(this.queue.map((i) => i.id));
        for (const invite of invites) {
          if (invite.id === currentId || queuedIds.has(invite.id)) continue;
          if (!this.incoming()) this.incoming.set(invite);
          else this.queue.push(invite);
        }
      },
      error: () => undefined,
    });
  }

  accept() {
    const invite = this.incoming();
    if (!invite || this.resolving()) return;
    this.resolving.set(true);
    this.api.acceptTeamInvite(invite.id).subscribe({
      next: (res) => {
        this.dismiss(invite.id);
        this.resolving.set(false);
        this.bump();
        this.activeTeams.enterTeam(res.teamId, res.teamName || invite.teamName);
      },
      error: () => {
        this.resolving.set(false);
        this.toast.error('No se pudo aceptar la invitación');
      },
    });
  }

  reject() {
    const invite = this.incoming();
    if (!invite || this.resolving()) return;
    this.resolving.set(true);
    this.api.rejectTeamInvite(invite.id).subscribe({
      next: () => {
        this.dismiss(invite.id);
        this.resolving.set(false);
        this.bump();
      },
      error: () => {
        this.resolving.set(false);
        this.toast.error('No se pudo rechazar la invitación');
      },
    });
  }

  acceptById(inviteId: string) {
    return this.api.acceptTeamInvite(inviteId);
  }

  rejectById(inviteId: string) {
    return this.api.rejectTeamInvite(inviteId);
  }

  private attach() {
    this.sockets.connect();
    this.sockets.on('team-invite', this.onInvite);
    this.sockets.on('team-invite-resolved', this.onResolved);
    this.bound = true;
  }

  private detach(clearState: boolean) {
    if (this.bound) {
      this.sockets.off('team-invite', this.onInvite);
      this.sockets.off('team-invite-resolved', this.onResolved);
      this.bound = false;
    }
    if (clearState) {
      this.incoming.set(null);
      this.queue = [];
    }
  }

  private dismiss(id: string) {
    this.queue = this.queue.filter((item) => item.id !== id);
    if (this.incoming()?.id === id) {
      this.incoming.set(this.queue.shift() ?? null);
    }
  }

  private bump() {
    this.changed.update((n) => n + 1);
  }
}

function readString(payload: unknown, key: string): string {
  if (!payload || typeof payload !== 'object') return '';
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : '';
}

function parseInvite(payload: unknown): TeamInvite | null {
  if (!payload || typeof payload !== 'object') return null;
  const value = payload as Partial<TeamInvite> & {
    inviter?: { id?: string; name?: string; email?: string; avatarId?: string | null };
  };
  if (!value.id || !value.teamId || !value.inviter?.id || !value.inviter.name) {
    return null;
  }
  return {
    id: value.id,
    teamId: value.teamId,
    teamName: value.teamName || 'Equipo',
    teamLogoUrl: value.teamLogoUrl ?? null,
    createdAt: String(value.createdAt ?? ''),
    inviter: {
      id: value.inviter.id,
      name: value.inviter.name,
      email: value.inviter.email ?? '',
      avatarId: value.inviter.avatarId ?? null,
    },
  };
}
