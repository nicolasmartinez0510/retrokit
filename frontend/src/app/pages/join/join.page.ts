import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { randomAvatarId } from '../../core/avatars';
import { AvatarPickerComponent } from '../../shared/avatar-picker.component';
import { UserAvatarComponent } from '../../shared/user-avatar.component';

@Component({
  selector: 'app-join-page',
  imports: [FormsModule, AvatarPickerComponent, UserAvatarComponent],
  template: `
    <div class="auth-wrap">
      <div class="card auth-card">
        <h1>Unirse a la retrospectiva</h1>
        <p class="subtitle">Código: {{ code }}</p>

        @if (auth.isUser()) {
          <div class="member-preview">
            <app-user-avatar
              [avatarId]="auth.user()?.avatarId"
              [seed]="auth.user()?.id || ''"
              [name]="auth.user()?.name || ''"
              size="lg"
            />
            <p class="info">Entrarás como miembro autenticado.</p>
          </div>
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
            <app-avatar-picker [(avatarId)]="avatarId" />
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
      overflow: visible;
    }
    .subtitle,
    .info,
    .hint {
      color: var(--color-text-muted);
      font-size: 0.9rem;
    }
    .member-preview {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .member-preview .info {
      margin: 0;
    }
    form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      overflow: visible;
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
  avatarId = randomAvatarId();
  loading = signal(false);
  error = signal('');

  ngOnInit() {
    this.code = this.route.snapshot.paramMap.get('code') || '';
  }

  joinGuest() {
    this.loading.set(true);
    this.error.set('');
    this.api.joinRetro(this.code, this.name.trim(), this.avatarId).subscribe({
      next: (res) => {
        if (res.accessToken) {
          this.auth.setGuestToken(
            res.accessToken,
            this.name.trim(),
            res.retroId,
            res.participant.id,
            res.participant.avatarId ?? this.avatarId,
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
