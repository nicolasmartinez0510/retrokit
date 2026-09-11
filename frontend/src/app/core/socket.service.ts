import { Injectable, inject } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class SocketService {
  private readonly auth = inject(AuthService);
  private socket: Socket | null = null;
  private connectedToken: string | null | undefined = undefined;
  private joinedRetroId: string | null = null;

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
        this.socket?.emit('join-retro', { retroId: this.joinedRetroId });
      }
    });
    return this.socket;
  }

  joinRetro(retroId: string) {
    const s = this.connect();
    if (this.joinedRetroId && this.joinedRetroId !== retroId) {
      s.emit('leave-retro', { retroId: this.joinedRetroId });
    }
    this.joinedRetroId = retroId;
    s.emit('join-retro', { retroId });
    return s;
  }

  leaveRetro(retroId?: string) {
    const id = retroId ?? this.joinedRetroId;
    if (!id) return;
    this.socket?.emit('leave-retro', { retroId: id });
    if (this.joinedRetroId === id) this.joinedRetroId = null;
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
    this.socket?.disconnect();
    this.socket = null;
    this.connectedToken = undefined;
  }
}
