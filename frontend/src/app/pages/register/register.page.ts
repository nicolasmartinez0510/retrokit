import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { randomAvatarId } from '../../core/avatars';
import { AvatarPickerComponent } from '../../shared/avatar-picker.component';
import { BrandLogo } from '../../shared/brand-logo.component';

function safeReturnUrl(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

@Component({
  selector: 'app-register-page',
  imports: [FormsModule, RouterLink, BrandLogo, AvatarPickerComponent],
  template: `
    <div class="auth-wrap">
      <form class="card auth-card" (ngSubmit)="submit()">
        <app-brand-logo [lockup]="true" />
        <h1>Crear cuenta</h1>
        <p class="subtitle">Empieza a facilitar retrospectivas</p>
        <app-avatar-picker [(avatarId)]="avatarId" />
        <div class="field">
          <label for="name">Nombre</label>
          <input id="name" [(ngModel)]="name" name="name" required />
        </div>
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
            minlength="6"
            required
          />
        </div>
        @if (error()) {
          <p class="form-error">{{ error() }}</p>
        }
        <button class="btn-primary" type="submit" [disabled]="loading()">
          Registrarme
        </button>
        <p class="switch">
          ¿Ya tienes cuenta?
          <a routerLink="/login" [queryParams]="loginParams">Inicia sesión</a>
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
      overflow: visible;
    }
    h1 { font-size: 1.35rem; text-align: center; }
    .subtitle { color: var(--color-text-muted); margin-bottom: 0.5rem; text-align: center; }
    .switch { font-size: 0.9rem; color: var(--color-text-muted); text-align: center; }
  `,
})
export class RegisterPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  name = '';
  email = '';
  password = '';
  avatarId = randomAvatarId();
  loading = signal(false);
  error = signal('');
  private returnUrl: string | null = null;
  loginParams: Record<string, string> = {};

  ngOnInit() {
    this.returnUrl = safeReturnUrl(
      this.route.snapshot.queryParamMap.get('returnUrl'),
    );
    this.loginParams = this.returnUrl ? { returnUrl: this.returnUrl } : {};
  }

  submit() {
    this.loading.set(true);
    this.error.set('');
    this.auth
      .register({
        name: this.name,
        email: this.email,
        password: this.password,
        avatarId: this.avatarId,
      })
      .subscribe({
        next: () => {
          this.loading.set(false);
          void this.router.navigateByUrl(this.returnUrl || '/dashboard');
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(err?.error?.message || 'No se pudo registrar');
        },
      });
  }
}
