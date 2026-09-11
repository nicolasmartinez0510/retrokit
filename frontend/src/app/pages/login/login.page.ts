import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { BrandLogo } from '../../shared/brand-logo.component';

function safeReturnUrl(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

@Component({
  selector: 'app-login-page',
  imports: [FormsModule, RouterLink, BrandLogo],
  template: `
    <div class="auth-wrap">
      <form class="card auth-card" (ngSubmit)="submit()">
        <div class="auth-mark" aria-hidden="true">
          <app-brand-logo />
        </div>
        <h1>Iniciar sesión</h1>
        <p class="subtitle">Bienvenido a Retrokit</p>
        <div class="field">
          <label for="email">Email</label>
          <input id="email" type="email" [(ngModel)]="email" name="email" required />
        </div>
        <div class="field">
          <label for="password">Contraseña</label>
          <input
            id="password"
            type="password"
            [(ngModel)]="password"
            name="password"
            required
          />
        </div>
        @if (error()) {
          <p class="form-error">{{ error() }}</p>
        }
        <button class="btn-primary" type="submit" [disabled]="loading()">
          Entrar
        </button>
        <p class="switch">
          ¿No tienes cuenta?
          <a routerLink="/register" [queryParams]="registerParams">Regístrate</a>
        </p>
      </form>
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
    h1 { font-size: 1.5rem; text-align: center; }
    .auth-mark {
      width: 4.5rem;
      height: 2.8rem;
      margin: 0 auto 0.25rem;
      color: var(--color-brand);
    }
    .subtitle { color: var(--color-text-muted); margin-bottom: 0.5rem; text-align: center; }
    .switch { font-size: 0.9rem; color: var(--color-text-muted); text-align: center; }
  `,
})
export class LoginPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  email = '';
  password = '';
  loading = signal(false);
  error = signal('');
  private returnUrl: string | null = null;
  registerParams: Record<string, string> = {};

  ngOnInit() {
    this.returnUrl = safeReturnUrl(
      this.route.snapshot.queryParamMap.get('returnUrl'),
    );
    this.registerParams = this.returnUrl
      ? { returnUrl: this.returnUrl }
      : {};
  }

  submit() {
    this.loading.set(true);
    this.error.set('');
    this.auth.login({ email: this.email, password: this.password }).subscribe({
      next: () => {
        this.loading.set(false);
        void this.router.navigateByUrl(this.returnUrl || '/dashboard');
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'No se pudo iniciar sesión');
      },
    });
  }
}
