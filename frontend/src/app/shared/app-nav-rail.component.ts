import {
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ActiveTeamService } from '../core/active-team.service';
import { AuthService } from '../core/auth.service';
import { FavoriteTeamsService } from '../core/favorite-teams.service';
import { httpErrorMessage } from '../core/http-error';
import { NavRailLayoutService } from '../core/nav-rail-layout.service';
import { ThemeService } from '../core/theme.service';
import { ToastService } from '../core/toast.service';
import { TeamSummary } from '../core/models';
import { AvatarMenuComponent } from './avatar-menu.component';
import { BrandLogo } from './brand-logo.component';
import { TeamCreateJoinModalComponent } from './team-create-join-modal.component';

@Component({
  selector: 'app-nav-rail',
  imports: [RouterLink, RouterLinkActive, BrandLogo, AvatarMenuComponent, TeamCreateJoinModalComponent],
  template: `
    <aside
      class="nav-rail"
      [class.expanded]="layout.expanded()"
      aria-label="Navegación principal"
    >
      <div class="rail-top">
        <a routerLink="/dashboard" class="brand" title="Retrokit">
          <span class="logo" aria-hidden="true">
            <app-brand-logo />
          </span>
          @if (layout.expanded()) {
            <span class="brand-name">Retrokit</span>
          }
        </a>
      </div>

      <div class="team-wrap">
        <button
          type="button"
          class="team-btn"
          [disabled]="!hasTeams()"
          [attr.aria-expanded]="teamMenuOpen()"
          aria-haspopup="listbox"
          [attr.aria-label]="
            !hasTeams()
              ? 'Sin equipos'
              : activeTeam()
                ? 'Equipo: ' + activeTeam()!.name
                : 'Seleccionar equipo'
          "
          [title]="
            !hasTeams()
              ? 'No hay equipos todavía'
              : activeTeam()?.name || 'Seleccionar equipo'
          "
          (click)="toggleTeamMenu($event)"
        >
          <span class="team-initial" aria-hidden="true">
            @if (activeTeam()?.logoUrl; as logo) {
              <img [src]="logo" alt="" />
            } @else {
              {{ teamInitial() }}
            }
          </span>
          @if (layout.expanded()) {
            <span class="team-meta">
              <span class="team-name">{{
                activeTeam()?.name || 'Sin equipo'
              }}</span>
              <span class="team-hint">{{
                hasTeams() ? 'Cambiar equipo' : 'Sin equipos'
              }}</span>
            </span>
            <svg class="chevron" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M19.5 8.25l-7.5 7.5-7.5-7.5"
              />
            </svg>
          }
        </button>

        @if (teamMenuOpen() && hasTeams()) {
          <div
            class="team-popover"
            role="listbox"
            aria-label="Equipos"
            (click)="$event.stopPropagation()"
          >
            <p class="popover-title">Equipos</p>
            <ul class="team-list">
              @for (team of teams(); track team.id) {
                <li
                  class="team-option"
                  role="option"
                  [attr.aria-selected]="team.id === activeTeamId()"
                  [class.active]="team.id === activeTeamId()"
                >
                  <button
                    type="button"
                    class="team-pick"
                    (click)="pickTeam(team)"
                  >
                    <span class="team-initial sm" aria-hidden="true">
                      @if (team.logoUrl) {
                        <img [src]="team.logoUrl" alt="" />
                      } @else {
                        {{ initialFor(team.name) }}
                      }
                    </span>
                    <span class="team-option-name">{{ team.name }}</span>
                  </button>
                  @if (team.role) {
                    <button
                      type="button"
                      class="star-btn"
                      [class.on]="!!team.favorited"
                      [attr.aria-label]="
                        team.favorited
                          ? 'Quitar de destacados'
                          : 'Destacar equipo'
                      "
                      [title]="
                        team.favorited
                          ? 'Quitar de destacados'
                          : 'Destacar equipo'
                      "
                      (click)="toggleFavorite($event, team)"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
                        />
                      </svg>
                    </button>
                  }
                </li>
              }
            </ul>
            <button
              type="button"
              class="popover-footer action"
              (click)="openCreate()"
            >
              + Agregar
            </button>
          </div>
        }
      </div>

      <nav class="rail-nav" aria-label="Secciones">
        @if (hasTeams()) {
          <a
            routerLink="/dashboard"
            routerLinkActive="active"
            class="nav-item"
            aria-label="Panel"
            title="Panel"
          >
            <svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z"
              />
            </svg>
            @if (layout.expanded()) {
              <span>Panel</span>
            }
          </a>
        } @else {
          <span
            class="nav-item disabled"
            aria-disabled="true"
            title="Necesitás un equipo"
          >
            <svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z"
              />
            </svg>
            @if (layout.expanded()) {
              <span>Panel</span>
            }
          </span>
        }

        @if (activeTeamId(); as teamId) {
          <a
            [routerLink]="['/teams', teamId]"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{
              paths: 'exact',
              queryParams: 'ignored',
              fragment: 'ignored',
              matrixParams: 'ignored'
            }"
            class="nav-item"
            aria-label="Retrospectivas"
            title="Retrospectivas"
          >
            <svg class="nav-icon outline" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
            @if (layout.expanded()) {
              <span>Retros</span>
            }
          </a>

          <a
            [routerLink]="['/teams', teamId, 'actions']"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{
              paths: 'exact',
              queryParams: 'ignored',
              fragment: 'ignored',
              matrixParams: 'ignored'
            }"
            class="nav-item"
            aria-label="Tablero de acciones"
            title="Tablero de acciones"
          >
            <svg class="nav-icon outline" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125Z"
              />
            </svg>
            @if (layout.expanded()) {
              <span>Acciones</span>
            }
          </a>

          <a
            [routerLink]="['/teams', teamId, 'members']"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{
              paths: 'exact',
              queryParams: 'ignored',
              fragment: 'ignored',
              matrixParams: 'ignored'
            }"
            class="nav-item"
            aria-label="Miembros"
            title="Miembros"
          >
            <svg class="nav-icon outline" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
              />
            </svg>
            @if (layout.expanded()) {
              <span>Miembros</span>
            }
          </a>
        } @else {
          <span
            class="nav-item disabled"
            aria-disabled="true"
            title="Necesitás un equipo"
          >
            <svg class="nav-icon outline" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
            @if (layout.expanded()) {
              <span>Retros</span>
            }
          </span>
          <span
            class="nav-item disabled"
            aria-disabled="true"
            title="Necesitás un equipo"
          >
            <svg class="nav-icon outline" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125Z"
              />
            </svg>
            @if (layout.expanded()) {
              <span>Acciones</span>
            }
          </span>
          <span
            class="nav-item disabled"
            aria-disabled="true"
            title="Necesitás un equipo"
          >
            <svg class="nav-icon outline" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
              />
            </svg>
            @if (layout.expanded()) {
              <span>Miembros</span>
            }
          </span>
        }

        <div class="nav-section" role="group" aria-label="Administrar">
          <div class="nav-section-label" aria-hidden="true">
            @if (layout.expanded()) {
              <span>Administrar</span>
            } @else {
              <span class="nav-section-rule"></span>
            }
          </div>

          <a
            routerLink="/teams"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: true }"
            class="nav-item"
            aria-label="Equipos"
            title="Equipos"
          >
            <svg class="nav-icon outline" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z"
              />
            </svg>
            @if (layout.expanded()) {
              <span>Equipos</span>
            }
          </a>

          <a
            routerLink="/templates"
            routerLinkActive="active"
            class="nav-item"
            aria-label="Plantillas"
            title="Plantillas"
          >
            <svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M5.566 4.657A4.505 4.505 0 0 1 6.75 4.5h10.5c.41 0 .806.055 1.183.157A3 3 0 0 0 15.75 3h-7.5a3 3 0 0 0-2.684 1.657ZM2.25 12a3 3 0 0 1 3-3h13.5a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3v-6ZM5.25 7.5c-.61 0-1.169.11-1.67.305a3 3 0 0 1 1.67-1.305h13.5c.61 0 1.169.11 1.67.305a3 3 0 0 0-1.67-1.305H5.25Z"
              />
            </svg>
            @if (layout.expanded()) {
              <span>Plantillas</span>
            }
          </a>

          @if (auth.user()?.isAdmin) {
            <a
              routerLink="/users"
              routerLinkActive="active"
              class="nav-item"
              aria-label="Usuarios"
              title="Usuarios"
            >
              <svg class="nav-icon outline" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
                />
              </svg>
              @if (layout.expanded()) {
                <span>Usuarios</span>
              }
            </a>
          }
        </div>
      </nav>

      <div class="rail-bottom">
        <button
          type="button"
          class="nav-item theme-btn"
          (click)="theme.toggle()"
          [attr.aria-label]="
            theme.theme() === 'dark'
              ? 'Cambiar a modo claro'
              : 'Cambiar a modo oscuro'
          "
          [title]="theme.theme() === 'dark' ? 'Modo claro' : 'Modo oscuro'"
        >
          @if (theme.theme() === 'dark') {
            <svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 2.25a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75ZM7.5 12a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0Zm11.878-5.378a.75.75 0 1 0-1.06-1.06l-1.591 1.59a.75.75 0 0 0 1.06 1.061l1.591-1.59ZM19.5 12a.75.75 0 0 1 .75-.75h2.25a.75.75 0 0 1 0 1.5H20.25a.75.75 0 0 1-.75-.75Zm-1.122 6.378a.75.75 0 0 0 0-1.06l-1.59-1.591a.75.75 0 1 0-1.061 1.06l1.59 1.591a.75.75 0 0 0 1.06 0ZM12 18a.75.75 0 0 1 .75.75V21a.75.75 0 0 1-1.5 0v-2.25A.75.75 0 0 1 12 18Zm-5.378-1.122a.75.75 0 0 0-1.06 0l-1.59 1.59a.75.75 0 0 0 1.06 1.061l1.59-1.59a.75.75 0 0 0 0-1.06ZM2.25 12A.75.75 0 0 1 3 11.25h2.25a.75.75 0 0 1 0 1.5H3A.75.75 0 0 1 2.25 12Zm5.378-8.378a.75.75 0 0 0-1.06-1.06L4.97 4.15a.75.75 0 1 0 1.06 1.06l1.59-1.59Z"
              />
            </svg>
          } @else {
            <svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z"
              />
            </svg>
          }
          @if (layout.expanded()) {
            <span>{{ theme.theme() === 'dark' ? 'Claro' : 'Oscuro' }}</span>
          }
        </button>

        <div class="account">
          <app-avatar-menu
            [avatarId]="auth.user()?.avatarId"
            [seed]="auth.user()?.id || ''"
            [name]="auth.user()?.name || ''"
          />
          @if (layout.expanded()) {
            <span class="user-name" [title]="auth.user()?.name || ''">{{
              auth.user()?.name
            }}</span>
            <button
              type="button"
              class="logout-btn"
              (click)="auth.logout()"
              title="Salir"
              aria-label="Salir"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M7.5 3.75A1.5 1.5 0 0 0 6 5.25v13.5a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5V15a.75.75 0 0 1 1.5 0v3.75a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3V5.25a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3V9A.75.75 0 0 1 15 9V5.25a1.5 1.5 0 0 0-1.5-1.5h-6Zm10.72 4.72a.75.75 0 0 1 1.06 0l3 3a.75.75 0 0 1 0 1.06l-3 3a.75.75 0 1 1-1.06-1.06l1.72-1.72H9a.75.75 0 0 1 0-1.5h10.94l-1.72-1.72a.75.75 0 0 1 0-1.06Z"
                />
              </svg>
            </button>
          }
        </div>
      </div>
    </aside>

    @if (showCreate()) {
      <app-team-create-join-modal
        (close)="showCreate.set(false)"
        (created)="onCreated()"
      />
    }
  `,
  styles: `
    :host {
      display: contents;
    }
    .nav-rail {
      --rail-pad: 0.55rem;
      position: sticky;
      top: 0;
      align-self: start;
      height: 100vh;
      height: 100dvh;
      width: var(--nav-rail-width);
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
      padding: 0.75rem var(--rail-pad);
      background: var(--color-bg);
      border-right: 1px solid var(--color-border);
      z-index: 30;
      transition: width 0.18s ease;
    }
    .nav-rail.expanded {
      width: var(--nav-rail-width-expanded);
    }
    .rail-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.35rem;
      min-height: 2.5rem;
    }
    .nav-rail:not(.expanded) .rail-top {
      justify-content: center;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.55rem;
      min-width: 0;
      text-decoration: none;
      color: var(--color-brand);
      font-family: var(--font-brand);
      font-weight: 800;
      font-size: 1.05rem;
      letter-spacing: -0.03em;
    }
    .nav-rail:not(.expanded) .brand {
      justify-content: center;
      width: 100%;
    }
    .brand:hover {
      text-decoration: none;
    }
    .logo {
      width: 2.15rem;
      height: 2.15rem;
      padding: 0.4rem 0.28rem;
      box-sizing: border-box;
      border-radius: 8px;
      background: linear-gradient(
        135deg,
        var(--color-brand),
        var(--color-sky-mid)
      );
      color: var(--color-on-brand);
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }
    .brand-name {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .expand-btn {
      appearance: none;
      border: none;
      background: transparent;
      color: var(--color-text-muted);
      width: 1.85rem;
      height: 1.85rem;
      border-radius: var(--radius-sm);
      display: grid;
      place-items: center;
      cursor: pointer;
      flex-shrink: 0;
      padding: 0;
    }
    .expand-btn:hover {
      background: var(--color-bg-muted);
      color: var(--color-text);
    }
    .expand-btn svg {
      width: 1.05rem;
      height: 1.05rem;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.75;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .team-wrap {
      position: relative;
    }
    .team-btn {
      appearance: none;
      width: 100%;
      display: flex;
      align-items: center;
      gap: 0.55rem;
      padding: 0.4rem;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      background: var(--color-bg-muted);
      color: var(--color-text);
      cursor: pointer;
      text-align: left;
      min-height: 2.5rem;
    }
    .nav-rail:not(.expanded) .team-btn {
      justify-content: center;
      padding: 0.4rem;
    }
    .nav-rail:not(.expanded) .team-initial {
      margin-inline: auto;
    }
    .team-btn:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
    .team-btn:not(:disabled):hover {
      border-color: color-mix(in srgb, var(--color-brand) 35%, var(--color-border));
    }
    .team-initial {
      width: 1.7rem;
      height: 1.7rem;
      border-radius: 6px;
      background: var(--color-sky-soft);
      color: var(--color-brand);
      font-weight: 700;
      font-size: 0.8rem;
      display: grid;
      place-items: center;
      flex-shrink: 0;
      text-transform: uppercase;
    }
    .team-initial img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: inherit;
    }
    .team-initial.sm {
      width: 1.45rem;
      height: 1.45rem;
      font-size: 0.72rem;
    }
    .team-meta {
      min-width: 0;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.05rem;
    }
    .team-name {
      font-weight: 650;
      font-size: 0.88rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .team-hint {
      font-size: 0.7rem;
      color: var(--color-text-muted);
    }
    .chevron {
      width: 0.95rem;
      height: 0.95rem;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.75;
      stroke-linecap: round;
      stroke-linejoin: round;
      color: var(--color-text-muted);
      flex-shrink: 0;
    }
    .team-popover {
      position: absolute;
      top: calc(100% + 0.35rem);
      left: 0;
      min-width: max(100%, 14rem);
      max-width: 18rem;
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      z-index: 40;
      padding: 0.55rem;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .nav-rail:not(.expanded) .team-popover {
      left: calc(100% + 0.4rem);
      top: 0;
    }
    .popover-title {
      margin: 0;
      padding: 0.2rem 0.35rem;
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--color-text-muted);
    }
    .team-list {
      list-style: none;
      margin: 0;
      padding: 0;
      max-height: 16rem;
      overflow: auto;
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }
    .team-option {
      display: flex;
      align-items: center;
      gap: 0.15rem;
      padding: 0.15rem 0.2rem 0.15rem 0.15rem;
      border-radius: var(--radius-sm);
      color: var(--color-text);
    }
    .team-option:hover,
    .team-option.active {
      background: var(--color-sky-soft);
    }
    .team-pick {
      appearance: none;
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.35rem;
      border: none;
      border-radius: var(--radius-sm);
      background: transparent;
      color: inherit;
      cursor: pointer;
      text-align: left;
      font: inherit;
    }
    .team-option-name {
      flex: 1;
      min-width: 0;
      font-size: 0.88rem;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .star-btn {
      appearance: none;
      border: none;
      background: transparent;
      color: var(--color-text-muted);
      width: 1.6rem;
      height: 1.6rem;
      border-radius: 999px;
      display: grid;
      place-items: center;
      cursor: pointer;
      padding: 0;
      flex-shrink: 0;
    }
    .star-btn:hover,
    .star-btn.on {
      color: #d4a017;
    }
    .star-btn svg {
      width: 0.95rem;
      height: 0.95rem;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.5;
    }
    .star-btn.on svg {
      fill: currentColor;
    }
    .popover-footer {
      display: block;
      padding: 0.45rem 0.4rem;
      border-top: 1px solid var(--color-border);
      margin-top: 0.15rem;
      font-size: 0.85rem;
      font-weight: 650;
      color: var(--color-brand);
      text-decoration: none;
    }
    .popover-footer:hover {
      text-decoration: underline;
    }
    .popover-footer.action {
      appearance: none;
      width: 100%;
      border: none;
      background: transparent;
      text-align: left;
      cursor: pointer;
      font: inherit;
      border-top: 1px solid var(--color-border);
      margin-top: 0.15rem;
      padding-top: 0.45rem;
    }
    .rail-nav {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      flex: 1;
      min-height: 0;
      overflow: auto;
      padding-top: 0.25rem;
    }
    .nav-section {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      margin-top: 0.55rem;
      padding-top: 0.55rem;
      border-top: 1px solid var(--color-border);
    }
    .nav-section-label {
      display: flex;
      align-items: center;
      min-height: 1.1rem;
      padding: 0 0.45rem 0.15rem;
      color: var(--color-text-muted);
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      opacity: 0.85;
    }
    .nav-rail:not(.expanded) .nav-section-label {
      justify-content: center;
      padding: 0.15rem 0.35rem 0.35rem;
    }
    .nav-section-rule {
      display: block;
      width: 1.1rem;
      height: 2px;
      border-radius: 999px;
      background: var(--color-border);
    }
    .nav-item {
      appearance: none;
      display: flex;
      align-items: center;
      gap: 0.65rem;
      min-height: 2.35rem;
      padding: 0.45rem;
      border: none;
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--color-text-muted);
      font: inherit;
      font-weight: 650;
      font-size: 0.9rem;
      text-decoration: none;
      cursor: pointer;
      width: 100%;
      box-sizing: border-box;
    }
    .nav-rail:not(.expanded) .nav-item {
      justify-content: center;
      padding: 0.5rem;
    }
    .nav-item:hover {
      color: var(--color-brand);
      background: var(--color-bg-muted);
      text-decoration: none;
    }
    .nav-item.active {
      color: var(--color-brand);
      background: var(--color-sky-soft);
    }
    .nav-item.disabled {
      opacity: 0.4;
      cursor: not-allowed;
      pointer-events: none;
    }
    .nav-icon {
      width: 1.25rem;
      height: 1.25rem;
      flex-shrink: 0;
      fill: currentColor;
    }
    .nav-icon.outline {
      fill: none;
      stroke: currentColor;
      stroke-width: 1.55;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .rail-bottom {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      padding-top: 0.35rem;
      border-top: 1px solid var(--color-border);
    }
    .theme-btn {
      justify-content: flex-start;
    }
    .account {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      min-width: 0;
      padding: 0.15rem;
    }
    .nav-rail:not(.expanded) .account {
      flex-direction: column;
      align-items: center;
    }
    .user-name {
      flex: 1;
      min-width: 0;
      font-size: 0.82rem;
      color: var(--color-text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .logout-btn {
      appearance: none;
      border: none;
      background: transparent;
      color: var(--color-text-muted);
      width: 1.85rem;
      height: 1.85rem;
      border-radius: 999px;
      display: grid;
      place-items: center;
      cursor: pointer;
      padding: 0;
      flex-shrink: 0;
    }
    .logout-btn:hover {
      background: var(--color-bg-muted);
      color: var(--color-text);
    }
    .logout-btn svg {
      width: 1.05rem;
      height: 1.05rem;
      fill: currentColor;
    }
  `,
})
export class AppNavRailComponent {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly router = inject(Router);
  private readonly activeTeams = inject(ActiveTeamService);
  private readonly favorites = inject(FavoriteTeamsService);
  private readonly toast = inject(ToastService);
  readonly layout = inject(NavRailLayoutService);
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);

  readonly teamMenuOpen = signal(false);
  readonly showCreate = signal(false);
  private readonly url = signal(this.router.url);

  readonly teams = this.activeTeams.teams;
  readonly activeTeamId = this.activeTeams.activeTeamId;
  readonly activeTeam = this.activeTeams.activeTeam;
  readonly hasTeams = this.activeTeams.hasTeams;

  readonly teamInitial = computed(() =>
    this.initialFor(this.activeTeam()?.name || '?'),
  );

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.url.set(e.urlAfterRedirects));
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent) {
    if (!this.teamMenuOpen()) return;
    if (!this.host.nativeElement.contains(ev.target as Node)) {
      this.teamMenuOpen.set(false);
    }
  }

  toggleTeamMenu(ev: MouseEvent) {
    ev.stopPropagation();
    if (!this.hasTeams()) return;
    const opening = !this.teamMenuOpen();
    this.teamMenuOpen.set(opening);
    if (opening) this.activeTeams.load();
  }

  closeTeamMenu() {
    this.teamMenuOpen.set(false);
  }

  openCreate() {
    this.teamMenuOpen.set(false);
    this.showCreate.set(true);
  }

  onCreated() {
    this.activeTeams.load();
  }

  pickTeam(team: TeamSummary) {
    this.activeTeams.selectTeam(team.id);
    this.teamMenuOpen.set(false);
  }

  toggleFavorite(ev: MouseEvent, team: TeamSummary) {
    ev.stopPropagation();
    const next = !team.favorited;
    const previousAt = team.favoritedAt;
    this.activeTeams.markFavorite(team.id, next);
    this.favorites.setFavorite(team.id, next, team.name).subscribe({
      next: (res) =>
        this.activeTeams.markFavorite(team.id, res.favorited, res.favoritedAt),
      error: (e) => {
        this.activeTeams.markFavorite(team.id, !next, previousAt);
        this.toast.error(httpErrorMessage(e, 'No se pudo actualizar'));
      },
    });
  }

  initialFor(name: string) {
    const trimmed = name.trim();
    return trimmed ? trimmed.charAt(0) : '?';
  }
}
