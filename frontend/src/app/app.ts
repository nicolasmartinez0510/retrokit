import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from './core/auth.service';
import { ActiveTeamService } from './core/active-team.service';
import { JoinRequestService } from './core/join-request.service';
import { NavRailLayoutService } from './core/nav-rail-layout.service';
import { TeamInviteService } from './core/team-invite.service';
import { ThemeService } from './core/theme.service';
import { ToastService } from './core/toast.service';
import { AppNavRailComponent } from './shared/app-nav-rail.component';
import { BrandLogo } from './shared/brand-logo.component';
import { UserAvatarComponent } from './shared/user-avatar.component';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    BrandLogo,
    AppNavRailComponent,
    UserAvatarComponent,
  ],
  template: `
    @if (showRail()) {
      <div class="app-shell" [class.rail-expanded]="layout.expanded()">
        <app-nav-rail />
        <main class="app-main">
          <button
            type="button"
            class="rail-expand-fab"
            (click)="layout.toggle()"
            [attr.aria-label]="
              layout.expanded() ? 'Contraer menú' : 'Expandir menú'
            "
            [title]="layout.expanded() ? 'Contraer' : 'Expandir'"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              @if (layout.expanded()) {
                <path d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15l-7.5-7.5 7.5-7.5" />
              } @else {
                <path d="M5.25 4.5l7.5 7.5-7.5 7.5m6-15l7.5 7.5-7.5 7.5" />
              }
            </svg>
          </button>
          <router-outlet />
        </main>
      </div>
    } @else {
      <header class="topbar">
        <a routerLink="/" class="brand">
          <span class="logo" aria-hidden="true">
            <app-brand-logo />
          </span>
          <span>Retrokit</span>
        </a>
        <div class="topbar-right">
          @if (auth.isUser()) {
            <div class="user-chip">
              <app-user-avatar
                [avatarId]="auth.user()?.avatarId"
                [seed]="auth.user()?.id || ''"
                [name]="auth.user()?.name || ''"
                size="chip"
              />
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
              <app-user-avatar
                [avatarId]="auth.user()?.avatarId"
                [seed]="auth.user()?.id || ''"
                [name]="auth.user()?.name || ''"
                size="chip"
              />
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
              theme.theme() === 'dark'
                ? 'Cambiar a modo claro'
                : 'Cambiar a modo oscuro'
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
    }
    @if (teamInvites.incoming(); as invite) {
      <div
        class="join-request-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-invite-title"
      >
        <div class="card join-request-modal">
          <h2 id="team-invite-title">Invitación a equipo</h2>
          <p>
            <app-user-avatar
              [avatarId]="invite.inviter.avatarId"
              [ownerId]="invite.inviter.id"
              [seed]="invite.inviter.id"
              [name]="invite.inviter.name"
              size="sm"
            />
            <strong>{{ invite.inviter.name }}</strong>
            te invitó a
            <strong>{{ invite.teamName }}</strong>.
          </p>
          <div class="join-request-actions">
            <button
              type="button"
              class="btn-primary"
              [disabled]="teamInvites.resolving()"
              (click)="teamInvites.accept()"
            >
              {{ teamInvites.resolving() ? 'Guardando…' : 'Aceptar' }}
            </button>
            <button
              type="button"
              class="btn-danger"
              [disabled]="teamInvites.resolving()"
              (click)="teamInvites.reject()"
            >
              Rechazar
            </button>
          </div>
        </div>
      </div>
    }
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
            <app-user-avatar
              [avatarId]="request.user.avatarId"
              [ownerId]="request.user.id"
              [seed]="request.user.id"
              [name]="request.user.name"
              size="sm"
            />
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
    .app-shell {
      display: flex;
      align-items: stretch;
      min-height: 100vh;
      min-height: 100dvh;
    }
    .app-main {
      flex: 1;
      min-width: 0;
      position: relative;
    }
    .rail-expand-fab {
      appearance: none;
      position: sticky;
      top: 0.65rem;
      z-index: 25;
      margin: 0.65rem 0 0 0.65rem;
      width: 1.85rem;
      height: 1.85rem;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      background: var(--color-bg);
      color: var(--color-text-muted);
      display: grid;
      place-items: center;
      cursor: pointer;
      padding: 0;
      box-shadow: var(--shadow);
    }
    .rail-expand-fab:hover {
      color: var(--color-text);
      border-color: color-mix(in srgb, var(--color-brand) 35%, var(--color-border));
    }
    .rail-expand-fab svg {
      width: 1.05rem;
      height: 1.05rem;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.75;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
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
    .topbar-right {
      display: flex;
      align-items: center;
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
    .nav-link:hover {
      color: var(--color-brand);
    }
    .user-chip {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      min-width: 0;
      min-height: 2.15rem;
      padding: 0.15rem;
      border: 1px solid var(--color-border);
      border-radius: 999px;
      background: var(--color-bg-muted);
    }
    .user-chip.guest {
      padding: 0.15rem 0.75rem 0.15rem 0.15rem;
    }
    .user-name {
      color: var(--color-text-muted);
      font-size: 0.9rem;
      line-height: 1;
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
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.35rem;
    }
    .join-request-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 0.65rem;
    }
  `,
})
export class App {
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);
  readonly activeTeams = inject(ActiveTeamService);
  readonly theme = inject(ThemeService);
  readonly toast = inject(ToastService);
  readonly joinRequests = inject(JoinRequestService);
  readonly teamInvites = inject(TeamInviteService);
  readonly layout = inject(NavRailLayoutService);

  private readonly url = signal(this.router.url);

  readonly showRail = computed(() => {
    if (!this.auth.isUser()) return false;
    if (isChromeOnlyRoute(this.url())) return false;
    // Wait for memberships before showing the tool rail
    if (!this.activeTeams.ready()) return false;
    // Admin always gets the rail (Equipos / Usuarios); others need a team
    return this.activeTeams.hasTeams() || !!this.auth.user()?.isAdmin;
  });

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.url.set(e.urlAfterRedirects));
  }
}

function isChromeOnlyRoute(url: string): boolean {
  const path = url.split('?')[0].split('#')[0];
  return (
    path.startsWith('/retros') ||
    path.startsWith('/join/') ||
    path.startsWith('/join-team/') ||
    path === '/login' ||
    path === '/register' ||
    path === '/' ||
    path === ''
  );
}
