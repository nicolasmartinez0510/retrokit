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

import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-join-page',
  imports: [FormsModule],
  template: `
    <div class="auth-wrap">
      <div class="card auth-card">
        <h1>Unirse a la retrospectiva</h1>
        <p class="subtitle">Código: {{ code }}</p>

        @if (auth.isUser()) {
          <p class="info">Entrarás como miembro autenticado.</p>
          <button
            type="button"
            class="btn-primary"
            [disabled]="loading()"
            (click)="joinMember()"
          >
            {{ loading() ? 'Entrando…' : 'Entrar a la sala' }}
          </button>
        } @else {
          <form (ngSubmit)="joinGuest()">
            <div class="field">
              <label>Tu nombre</label>
              <input [(ngModel)]="name" name="name" required minlength="2" />
            </div>
            <button class="btn-primary" type="submit" [disabled]="loading()">
              {{ loading() ? 'Entrando…' : 'Entrar como invitado' }}
            </button>
          </form>
          <p class="hint">
            ¿Eres miembro del equipo? Inicia sesión y vuelve a este enlace.
          </p>
        }

        @if (error()) {
          <p class="form-error">{{ error() }}</p>
        }
      </div>
    </div>
  `,
  styles: `
    .auth-wrap {
      min-height: calc(100vh - 64px);
      display: grid;
      place-items: center;
      padding: 1.5rem;
      background: linear-gradient(180deg, var(--color-sky-soft), var(--color-bg-muted));
    }
    .auth-card {
      width: min(420px, 100%);
      padding: 2rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .subtitle,
    .info,
    .hint {
      color: var(--color-text-muted);
      font-size: 0.9rem;
    }
    form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
  `,
})
export class JoinPage implements OnInit {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  code = '';
  name = '';
  loading = signal(false);
  error = signal('');

  ngOnInit() {
    this.code = this.route.snapshot.paramMap.get('code') || '';
  }

  joinGuest() {
    this.loading.set(true);
    this.error.set('');
    this.api.joinRetro(this.code, this.name.trim()).subscribe({
      next: (res) => {
        if (res.accessToken) {
          this.auth.setGuestToken(
            res.accessToken,
            this.name.trim(),
            res.retroId,
            res.participant.id,
          );
        }
        this.loading.set(false);
        void this.router.navigate(['/retros', res.retroId]);
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(e?.error?.message || 'No se pudo unir');
      },
    });
  }

  joinMember() {
    this.loading.set(true);
    this.error.set('');
    this.api.joinRetro(this.code).subscribe({
      next: (res) => {
        this.loading.set(false);
        void this.router.navigate(['/retros', res.retroId]);
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(e?.error?.message || 'No se pudo unir');
      },
    });
  }
}
