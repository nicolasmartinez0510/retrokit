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

import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  template: `
    <header class="topbar">
      <a routerLink="/" class="brand">
        <span class="logo">R</span>
        <span>Retrokit</span>
      </a>
      @if (auth.isUser()) {
        <div class="topbar-right">
          <a routerLink="/dashboard" class="nav-link">Panel</a>
          <span class="user-name">{{ auth.user()?.name }}</span>
          <button type="button" class="btn-ghost btn-sm" (click)="auth.logout()">
            Salir
          </button>
        </div>
      } @else if (auth.isGuest()) {
        <div class="topbar-right">
          <span class="user-name">Invitado · {{ auth.user()?.name }}</span>
        </div>
      } @else {
        <div class="topbar-right">
          <a routerLink="/login" class="nav-link">Entrar</a>
          <a routerLink="/register" class="btn-primary btn-sm">Registrarse</a>
        </div>
      }
    </header>
    <main>
      <router-outlet />
    </main>
  `,
  styles: `
    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.85rem 1.25rem;
      background: var(--color-bg);
      border-bottom: 1px solid var(--color-border);
      position: sticky;
      top: 0;
      z-index: 20;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      font-weight: 700;
      font-size: 1.15rem;
      color: var(--color-brand);
      text-decoration: none;
    }
    .logo {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: linear-gradient(135deg, var(--color-brand), var(--color-sky-mid));
      color: white;
      display: grid;
      place-items: center;
      font-size: 0.95rem;
    }
    .topbar-right {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .nav-link {
      color: var(--color-text-muted);
      font-weight: 600;
      font-size: 0.9rem;
      text-decoration: none;
    }
    .nav-link:hover {
      color: var(--color-brand);
    }
    .user-name {
      color: var(--color-text-muted);
      font-size: 0.9rem;
    }
  `,
})
export class App {
  readonly auth = inject(AuthService);
}
