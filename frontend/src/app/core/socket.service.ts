import { Injectable, inject } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class SocketService {
  private readonly auth = inject(AuthService);
  private socket: Socket | null = null;

  connect() {
    if (this.socket?.connected) return this.socket;
    this.socket?.disconnect();
    const token = this.auth.token();
    this.socket = io(environment.wsUrl || undefined, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: token ? { token } : undefined,
    });
    return this.socket;
  }

  joinRetro(retroId: string) {
    const s = this.connect();
    s.emit('join-retro', { retroId });
    return s;
  }

  on(event: string, handler: (...args: unknown[]) => void) {
    this.connect().on(event, handler);
  }

  off(event: string, handler?: (...args: unknown[]) => void) {
    if (handler) this.socket?.off(event, handler);
    else this.socket?.off(event);
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }
}
