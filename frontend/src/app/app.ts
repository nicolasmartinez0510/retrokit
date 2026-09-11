import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';
import { JoinRequestService } from './core/join-request.service';
import { ThemeService } from './core/theme.service';
import { ToastService } from './core/toast.service';
import { BrandLogo } from './shared/brand-logo.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, BrandLogo],
  template: `
    <header class="topbar">
      <a routerLink="/" class="brand">
        <span class="logo" aria-hidden="true">
          <app-brand-logo />
        </span>
        <span>Retrokit</span>
      </a>
      <nav class="topbar-nav" aria-label="Principal">
        @if (auth.isUser()) {
          <a
            routerLink="/dashboard"
            routerLinkActive="active"
            class="nav-link"
            aria-label="Panel"
          >
            <svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z"
              />
            </svg>
            <span>Panel</span>
          </a>
          @if (auth.user()?.isFacilitator) {
            <a
              routerLink="/templates"
              routerLinkActive="active"
              class="nav-link"
              aria-label="Plantillas"
            >
              <svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M5.566 4.657A4.505 4.505 0 0 1 6.75 4.5h10.5c.41 0 .806.055 1.183.157A3 3 0 0 0 15.75 3h-7.5a3 3 0 0 0-2.684 1.657ZM2.25 12a3 3 0 0 1 3-3h13.5a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3v-6ZM5.25 7.5c-.61 0-1.169.11-1.67.305a3 3 0 0 1 1.67-1.305h13.5c.61 0 1.169.11 1.67.305a3 3 0 0 0-1.67-1.305H5.25Z"
                />
              </svg>
              <span>Plantillas</span>
            </a>
          }
        }
      </nav>
      <div class="topbar-right">
        @if (auth.isUser()) {
          <div class="user-chip">
            <span class="user-name">{{ auth.user()?.name }}</span>
            <button
              type="button"
              class="btn-ghost btn-sm logout-btn"
              (click)="auth.logout()"
              title="Salir"
              aria-label="Salir"
            >
              <svg class="logout-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M7.5 3.75A1.5 1.5 0 0 0 6 5.25v13.5a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5V15a.75.75 0 0 1 1.5 0v3.75a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3V5.25a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3V9A.75.75 0 0 1 15 9V5.25a1.5 1.5 0 0 0-1.5-1.5h-6Zm10.72 4.72a.75.75 0 0 1 1.06 0l3 3a.75.75 0 0 1 0 1.06l-3 3a.75.75 0 1 1-1.06-1.06l1.72-1.72H9a.75.75 0 0 1 0-1.5h10.94l-1.72-1.72a.75.75 0 0 1 0-1.06Z"
                />
              </svg>
            </button>
          </div>
        } @else if (auth.isGuest()) {
          <div class="user-chip guest">
            <span class="user-name">Invitado · {{ auth.user()?.name }}</span>
          </div>
        } @else {
          <a routerLink="/login" class="nav-link text-only">Entrar</a>
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
    @if (joinRequests.incoming(); as request) {
      <div
        class="join-request-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="join-request-title"
      >
        <div class="card join-request-modal">
          <h2 id="join-request-title">Nueva solicitud de equipo</h2>
          <p>
            <strong>{{ request.user.name }}</strong>
            quiere sumarse a
            <strong>{{ request.teamName || 'tu equipo' }}</strong>.
          </p>
          <div class="join-request-actions">
            <button
              type="button"
              class="btn-primary"
              [disabled]="joinRequests.resolving()"
              (click)="joinRequests.accept()"
            >
              {{ joinRequests.resolving() ? 'Guardando…' : 'Aceptar' }}
            </button>
            <button
              type="button"
              class="btn-danger"
              [disabled]="joinRequests.resolving()"
              (click)="joinRequests.reject()"
            >
              Rechazar
            </button>
          </div>
        </div>
      </div>
    }
    @if (toast.message()) {
      <button
        type="button"
        class="app-toast"
        [class.error]="toast.kind() === 'error'"
        role="status"
        aria-live="polite"
        (click)="toast.dismiss()"
      >
        {{ toast.message() }}
      </button>
    }
  `,
  styles: `
    .topbar {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 0.75rem;
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
      justify-self: start;
      font-family: var(--font-brand);
      font-weight: 800;
      font-size: 1.15rem;
      letter-spacing: -0.03em;
      color: var(--color-brand);
      text-decoration: none;
      min-width: 0;
    }
    .logo {
      width: 32px;
      height: 32px;
      padding: 7px 4px;
      box-sizing: border-box;
      border-radius: 8px;
      background: linear-gradient(135deg, var(--color-brand), var(--color-sky-mid));
      color: var(--color-on-brand);
      display: grid;
      place-items: center;
    }
    .topbar-nav {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      justify-self: center;
    }
    .topbar-right {
      display: flex;
      align-items: center;
      justify-self: end;
      gap: 0.75rem;
      min-width: 0;
    }
    .nav-link {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      color: var(--color-text-muted);
      font-weight: 600;
      font-size: 0.9rem;
      text-decoration: none;
      padding: 0.4rem 0.7rem;
      border-radius: var(--radius-sm);
    }
    .nav-link:hover,
    .nav-link.active {
      color: var(--color-brand);
    }
    .nav-link.active {
      background: var(--color-sky-soft);
    }
    .nav-icon {
      width: 1.15em;
      height: 1.15em;
      display: block;
      flex-shrink: 0;
      fill: currentColor;
    }
    .user-chip {
      display: flex;
      align-items: center;
      gap: 0.15rem;
      min-width: 0;
      padding: 0.15rem 0.2rem 0.15rem 0.75rem;
      border: 1px solid var(--color-border);
      border-radius: 999px;
      background: var(--color-bg-muted);
    }
    .user-chip.guest {
      padding: 0.4rem 0.8rem;
    }
    .user-name {
      color: var(--color-text-muted);
      font-size: 0.9rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 10rem;
    }
    .logout-btn {
      width: 1.85rem;
      height: 1.85rem;
      padding: 0;
      border-radius: 999px;
      flex-shrink: 0;
    }
    .logout-icon {
      width: 1.05em;
      height: 1.05em;
      display: block;
      fill: currentColor;
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
    .join-request-backdrop {
      position: fixed;
      inset: 0;
      z-index: 70;
      display: grid;
      place-items: center;
      padding: 1.25rem;
      background: var(--color-overlay);
      backdrop-filter: blur(4px);
    }
    .join-request-modal {
      width: min(420px, 100%);
      padding: 1.5rem 1.45rem 1.35rem;
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }
    .join-request-modal h2 {
      margin: 0;
      font-size: 1.15rem;
    }
    .join-request-modal p {
      margin: 0;
      color: var(--color-text-muted);
      line-height: 1.45;
    }
    .join-request-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 0.65rem;
    }
    @media (max-width: 720px) {
      .nav-link:not(.text-only) span {
        display: none;
      }
      .nav-link:not(.text-only) {
        padding: 0.4rem;
      }
      .user-name {
        max-width: 6.5rem;
      }
    }
  `,
})
export class App {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  readonly toast = inject(ToastService);
  readonly joinRequests = inject(JoinRequestService);
}
