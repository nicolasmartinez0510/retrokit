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

import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthResponse, User } from './models';

const TOKEN_KEY = 'retrokit_token';
const USER_KEY = 'retrokit_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly user = signal<User | null>(this.readUser());
  readonly token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  /** Any JWT present (user or guest). */
  readonly isLoggedIn = computed(() => !!this.token());
  /** Registered user (not guest). */
  readonly isUser = computed(
    () => !!this.token() && this.user()?.type !== 'guest',
  );
  readonly isGuest = computed(() => this.user()?.type === 'guest');

  register(payload: { email: string; password: string; name: string }) {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/register`, payload)
      .pipe(tap((res) => this.persist(res)));
  }

  login(payload: { email: string; password: string }) {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/login`, payload)
      .pipe(tap((res) => this.persist(res)));
  }

  setGuestToken(token: string, name: string, retroId: string, participantId: string) {
    localStorage.setItem(TOKEN_KEY, token);
    const user: User = {
      id: participantId,
      email: '',
      name,
      type: 'guest',
      participantId,
      retroId,
    };
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.token.set(token);
    this.user.set(user);
  }

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.token.set(null);
    this.user.set(null);
    void this.router.navigateByUrl('/login');
  }

  private persist(res: AuthResponse) {
    localStorage.setItem(TOKEN_KEY, res.accessToken);
    const user: User = { ...res.user, type: 'user' };
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.token.set(res.accessToken);
    this.user.set(user);
  }

  private readUser(): User | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  }
}
