// This file is part of Retrokit.
//
// Copyright (C) 2026 Nicolas Martinez
//
// Retrokit is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Retrokit is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Retrokit.  If not, see <https://www.gnu.org/licenses/>.

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
