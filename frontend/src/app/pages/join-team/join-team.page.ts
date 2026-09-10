import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-join-team-page',
  imports: [RouterLink],
  template: `
    <div class="auth-wrap">
      <div class="card auth-card">
        <h1>Unirse al equipo</h1>
        <p class="subtitle">Código de invitación: {{ code }}</p>

        @if (auth.isUser()) {
          <p class="info">Entrarás como miembro del equipo con tu cuenta.</p>
          <button
            type="button"
            class="btn-primary"
            [disabled]="loading()"
            (click)="join()"
          >
            {{ loading() ? 'Uniéndote…' : 'Unirme al equipo' }}
          </button>
        } @else {
          <p class="info">
            Para sumarte al equipo necesitás una cuenta. Después volvés a este
            enlace automáticamente.
          </p>
          <div class="actions">
            <a class="btn-primary" [routerLink]="['/login']" [queryParams]="authParams">
              Iniciar sesión
            </a>
            <a class="btn-secondary" [routerLink]="['/register']" [queryParams]="authParams">
              Crear cuenta
            </a>
          </div>
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
    h1 {
      font-size: 1.5rem;
      margin: 0;
    }
    .subtitle,
    .info {
      color: var(--color-text-muted);
      font-size: 0.9rem;
      margin: 0;
      line-height: 1.45;
    }
    .actions {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }
    .actions a {
      text-align: center;
      text-decoration: none;
    }
  `,
})
export class JoinTeamPage implements OnInit {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  code = '';
  loading = signal(false);
  error = signal('');
  authParams: { returnUrl: string } = { returnUrl: '' };

  ngOnInit() {
    this.code = this.route.snapshot.paramMap.get('code') || '';
    this.authParams = { returnUrl: `/join-team/${this.code}` };
    if (this.auth.isUser() && this.code) {
      this.join();
    }
  }

  join() {
    if (!this.code || this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.api.joinTeam(this.code).subscribe({
      next: (team) => {
        this.loading.set(false);
        void this.router.navigate(['/teams', team.id]);
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(e?.error?.message || 'No se pudo unir al equipo');
      },
    });
  }
}
