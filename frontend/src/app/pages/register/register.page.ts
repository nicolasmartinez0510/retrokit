import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-register-page',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="auth-wrap">
      <form class="card auth-card" (ngSubmit)="submit()">
        <h1>Crear cuenta</h1>
        <p class="subtitle">Empieza a facilitar retrospectivas</p>
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
          <a routerLink="/login">Inicia sesión</a>
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
    h1 { font-size: 1.5rem; }
    .subtitle { color: var(--color-text-muted); margin-bottom: 0.5rem; }
    .switch { font-size: 0.9rem; color: var(--color-text-muted); text-align: center; }
  `,
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  name = '';
  email = '';
  password = '';
  loading = signal(false);
  error = signal('');

  submit() {
    this.loading.set(true);
    this.error.set('');
    this.auth
      .register({ name: this.name, email: this.email, password: this.password })
      .subscribe({
        next: () => {
          this.loading.set(false);
          void this.router.navigateByUrl('/dashboard');
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(err?.error?.message || 'No se pudo registrar');
        },
      });
  }
}
