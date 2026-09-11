import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { TeamJoinRequest } from './models';
import { SocketService } from './socket.service';
import { ToastService } from './toast.service';

@Injectable({ providedIn: 'root' })
export class JoinRequestService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly sockets = inject(SocketService);
  private readonly toast = inject(ToastService);

  readonly incoming = signal<TeamJoinRequest | null>(null);
  readonly resolving = signal(false);
  readonly changed = signal(0);

  private queue: TeamJoinRequest[] = [];
  private bound = false;

  private readonly onRequest = (payload: unknown) => {
    const request = parseJoinRequest(payload);
    if (!request) return;
    if (this.incoming()?.id === request.id) return;
    if (this.queue.some((item) => item.id === request.id)) return;
    if (this.incoming()) {
      this.queue.push(request);
      return;
    }
    this.incoming.set(request);
  };

  private readonly onResolved = (payload: unknown) => {
    const id = readString(payload, 'id');
    if (id) this.dismiss(id);
    this.bump();
  };

  private readonly onAccepted = (payload: unknown) => {
    const name = readString(payload, 'teamName') || 'el equipo';
    this.toast.ok(`Te sumaron a ${name}. Ya podés entrar a la retro.`);
    this.bump();
  };

  private readonly onRejected = (payload: unknown) => {
    const name = readString(payload, 'teamName') || 'el equipo';
    this.toast.error(`No te sumaron a ${name}.`);
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
        } else {
          this.detach(true);
        }
      });
    });
  }

  accept() {
    const request = this.incoming();
    if (!request || this.resolving()) return;
    this.resolving.set(true);
    this.api.acceptJoinRequest(request.teamId, request.id).subscribe({
      next: () => {
        this.dismiss(request.id);
        this.resolving.set(false);
      },
      error: () => {
        this.resolving.set(false);
        this.toast.error('No se pudo aceptar la solicitud');
      },
    });
  }

  reject() {
    const request = this.incoming();
    if (!request || this.resolving()) return;
    this.resolving.set(true);
    this.api.rejectJoinRequest(request.teamId, request.id).subscribe({
      next: () => {
        this.dismiss(request.id);
        this.resolving.set(false);
      },
      error: () => {
        this.resolving.set(false);
        this.toast.error('No se pudo rechazar la solicitud');
      },
    });
  }

  private attach() {
    this.sockets.connect();
    this.sockets.on('team-join-request', this.onRequest);
    this.sockets.on('team-join-request-resolved', this.onResolved);
    this.sockets.on('team-join-accepted', this.onAccepted);
    this.sockets.on('team-join-rejected', this.onRejected);
    this.bound = true;
  }

  private detach(clearState: boolean) {
    if (this.bound) {
      this.sockets.off('team-join-request', this.onRequest);
      this.sockets.off('team-join-request-resolved', this.onResolved);
      this.sockets.off('team-join-accepted', this.onAccepted);
      this.sockets.off('team-join-rejected', this.onRejected);
      this.bound = false;
    }
    if (clearState) {
      this.incoming.set(null);
      this.queue = [];
    }
    if (!this.auth.isUser() && !this.auth.isGuest()) {
      this.sockets.disconnect();
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

function parseJoinRequest(payload: unknown): TeamJoinRequest | null {
  if (!payload || typeof payload !== 'object') return null;
  const value = payload as Partial<TeamJoinRequest> & {
    user?: { id?: string; name?: string; email?: string; avatarId?: string | null };
  };
  if (!value.id || !value.teamId || !value.user?.id || !value.user.name) {
    return null;
  }
  return {
    id: value.id,
    teamId: value.teamId,
    teamName: value.teamName,
    createdAt: String(value.createdAt ?? ''),
    user: {
      id: value.user.id,
      name: value.user.name,
      email: value.user.email ?? '',
      avatarId: value.user.avatarId ?? null,
    },
  };
}
