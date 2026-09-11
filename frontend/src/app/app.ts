import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';
import { ThemeService } from './core/theme.service';
import { BrandLogo } from './shared/brand-logo.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, BrandLogo],
  template: `
    <header class="topbar">
      <a routerLink="/" class="brand">
        <span class="logo" aria-hidden="true">
          <app-brand-logo />
        </span>
        <span>Retrokit</span>
      </a>
      <div class="topbar-right">
        @if (auth.isUser()) {
          <a routerLink="/dashboard" class="nav-link">Panel</a>
          @if (auth.user()?.isFacilitator) {
            <a routerLink="/templates" class="nav-link">Plantillas</a>
          }
          <span class="user-name">{{ auth.user()?.name }}</span>
          <button type="button" class="btn-ghost btn-sm" (click)="auth.logout()">
            Salir
          </button>
        } @else if (auth.isGuest()) {
          <span class="user-name">Invitado · {{ auth.user()?.name }}</span>
        } @else {
          <a routerLink="/login" class="nav-link">Entrar</a>
          <a routerLink="/register" class="btn-primary btn-sm">Registrarse</a>
        }
        <button
          type="button"
          class="btn-secondary btn-sm theme-toggle"
          (click)="theme.toggle()"
          [attr.aria-label]="
            theme.theme() === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'
          "
          [title]="theme.theme() === 'dark' ? 'Modo claro' : 'Modo oscuro'"
        >
          @if (theme.theme() === 'dark') {
            <svg class="theme-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 2.25a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75ZM7.5 12a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0Zm11.878-5.378a.75.75 0 1 0-1.06-1.06l-1.591 1.59a.75.75 0 0 0 1.06 1.061l1.591-1.59ZM19.5 12a.75.75 0 0 1 .75-.75h2.25a.75.75 0 0 1 0 1.5H20.25a.75.75 0 0 1-.75-.75Zm-1.122 6.378a.75.75 0 0 0 0-1.06l-1.59-1.591a.75.75 0 1 0-1.061 1.06l1.59 1.591a.75.75 0 0 0 1.06 0ZM12 18a.75.75 0 0 1 .75.75V21a.75.75 0 0 1-1.5 0v-2.25A.75.75 0 0 1 12 18Zm-5.378-1.122a.75.75 0 0 0-1.06 0l-1.59 1.59a.75.75 0 0 0 1.06 1.061l1.59-1.59a.75.75 0 0 0 0-1.06ZM2.25 12A.75.75 0 0 1 3 11.25h2.25a.75.75 0 0 1 0 1.5H3A.75.75 0 0 1 2.25 12Zm5.378-8.378a.75.75 0 0 0-1.06-1.06L4.97 4.15a.75.75 0 1 0 1.06 1.06l1.59-1.59Z"
              />
            </svg>
            <span>Claro</span>
          } @else {
            <svg class="theme-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z"
              />
            </svg>
            <span>Oscuro</span>
          }
        </button>
      </div>
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
      padding: 6px 4px 4px;
      box-sizing: border-box;
      border-radius: 8px;
      background: linear-gradient(135deg, var(--color-brand), var(--color-sky-mid));
      color: var(--color-on-brand);
      display: grid;
      place-items: center;
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
    .theme-toggle {
      min-width: 5.75rem;
      flex-shrink: 0;
      gap: 0.35rem;
      line-height: 1;
    }
    .theme-toggle span {
      line-height: 1;
      display: block;
    }
    .theme-icon {
      width: 1em;
      height: 1em;
      display: block;
      flex-shrink: 0;
      fill: currentColor;
    }
    .theme-icon path {
      fill: currentColor;
    }
  `,
})
export class App {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
}
