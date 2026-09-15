import { Injectable, inject } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export type SocketPresence = {
  participantId: string;
  name: string;
  avatarId?: string | null;
};

@Injectable({ providedIn: 'root' })
export class SocketService {
  private readonly auth = inject(AuthService);
  private socket: Socket | null = null;
  private connectedToken: string | null | undefined = undefined;
  private joinedRetroId: string | null = null;
  private joinedPresence: SocketPresence | null = null;
  private joinedTeamId: string | null = null;

  connect() {
    const token = this.auth.token();
    if (this.socket && this.connectedToken === token) {
      if (!this.socket.connected) this.socket.connect();
      return this.socket;
    }
    this.socket?.disconnect();
    this.connectedToken = token;
    this.socket = io(environment.wsUrl || undefined, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: token ? { token } : undefined,
    });
    this.socket.on('connect', () => {
      if (this.joinedRetroId) {
        this.socket?.emit('join-retro', this.joinPayload(this.joinedRetroId));
      }
      if (this.joinedTeamId) {
        this.socket?.emit('join-team', { teamId: this.joinedTeamId });
      }
    });
    return this.socket;
  }

  joinRetro(retroId: string, presence?: SocketPresence | null) {
    const s = this.connect();
    if (this.joinedRetroId && this.joinedRetroId !== retroId) {
      s.emit('leave-retro', { retroId: this.joinedRetroId });
      this.joinedPresence = null;
    }
    this.joinedRetroId = retroId;
    if (presence) this.joinedPresence = presence;
    s.emit('join-retro', this.joinPayload(retroId));
    return s;
  }

  leaveRetro(retroId?: string) {
    const id = retroId ?? this.joinedRetroId;
    if (!id) return;
    this.socket?.emit('leave-retro', { retroId: id });
    if (this.joinedRetroId === id) {
      this.joinedRetroId = null;
      this.joinedPresence = null;
    }
  }

  joinTeam(teamId: string) {
    const s = this.connect();
    if (this.joinedTeamId && this.joinedTeamId !== teamId) {
      s.emit('leave-team', { teamId: this.joinedTeamId });
    }
    this.joinedTeamId = teamId;
    s.emit('join-team', { teamId });
    return s;
  }

  leaveTeam(teamId?: string) {
    const id = teamId ?? this.joinedTeamId;
    if (!id) return;
    this.socket?.emit('leave-team', { teamId: id });
    if (this.joinedTeamId === id) {
      this.joinedTeamId = null;
    }
  }

  emit(event: string, payload?: unknown) {
    this.connect().emit(event, payload);
  }

  on(event: string, handler: (...args: unknown[]) => void) {
    this.connect().on(event, handler);
  }

  off(event: string, handler?: (...args: unknown[]) => void) {
    if (handler) this.socket?.off(event, handler);
    else this.socket?.off(event);
  }

  disconnect() {
    this.joinedRetroId = null;
    this.joinedPresence = null;
    this.joinedTeamId = null;
    this.socket?.disconnect();
    this.socket = null;
    this.connectedToken = undefined;
  }

  private joinPayload(retroId: string) {
    const presence = this.joinedPresence;
    if (!presence) return { retroId };
    return {
      retroId,
      participantId: presence.participantId,
      name: presence.name,
      avatarId: presence.avatarId ?? null,
    };
  }
}
