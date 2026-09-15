import { Component, OnInit, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ActiveTeamService } from '../../core/active-team.service';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { FavoriteTeamsService } from '../../core/favorite-teams.service';
import { httpErrorMessage } from '../../core/http-error';
import { rejectImageFile } from '../../core/image-file';
import {
  TeamInvite,
  TeamSummary,
  UserSearchHit,
} from '../../core/models';
import { TeamInviteService } from '../../core/team-invite.service';
import { sortTeams, withFavorite } from '../../core/team-order';
import { ToastService } from '../../core/toast.service';
import { TeamCreateJoinModalComponent } from '../../shared/team-create-join-modal.component';
import { UserAvatarComponent } from '../../shared/user-avatar.component';

@Component({
  selector: 'app-teams-page',
  imports: [
    FormsModule,
    RouterLink,
    UserAvatarComponent,
    TeamCreateJoinModalComponent,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Equipos</h1>
          <p class="subtitle">Administrá tus equipos, invitaciones y logos</p>
        </div>
        <button type="button" class="btn-primary" (click)="showCreate.set(true)">
          + Crear equipo
        </button>
      </div>

      @if (error()) {
        <p class="form-error">{{ error() }}</p>
      }

      @if (incoming().length) {
        <section class="section">
          <h2>Invitaciones pendientes</h2>
          <div class="list">
            @for (invite of incoming(); track invite.id) {
              <div class="card row pending">
                <div class="team-id">
                  <span class="team-logo" aria-hidden="true">
                    @if (invite.teamLogoUrl) {
                      <img [src]="invite.teamLogoUrl" alt="" />
                    } @else {
                      {{ invite.teamName.charAt(0) }}
                    }
                  </span>
                  <div>
                    <strong>{{ invite.teamName }}</strong>
                    <p class="meta">
                      Invitó {{ invite.inviter.name }}
                    </p>
                  </div>
                </div>
                <div class="row-actions">
                  <button
                    type="button"
                    class="btn-primary btn-sm"
                    [disabled]="resolvingId() === invite.id"
                    (click)="acceptInvite(invite)"
                    title="Aceptar"
                    aria-label="Aceptar"
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    class="btn-danger btn-sm"
                    [disabled]="resolvingId() === invite.id"
                    (click)="rejectInvite(invite)"
                    title="Rechazar"
                    aria-label="Rechazar"
                  >
                    ✕
                  </button>
                </div>
              </div>
            }
          </div>
        </section>
      }

      <section class="section">
        <h2>Mis equipos</h2>
        @if (!teams().length) {
          <div class="empty-state">
            <strong>Todavía no tenés equipos</strong>
            Creá uno o unite con un código.
          </div>
        } @else {
          <div class="list">
            @for (team of teams(); track team.id) {
              <div class="card row">
                <a class="team-id" [routerLink]="['/teams', team.id]">
                  <span class="team-logo" aria-hidden="true">
                    @if (team.logoUrl) {
                      <img [src]="team.logoUrl" alt="" />
                    } @else {
                      {{ team.name.charAt(0) }}
                    }
                  </span>
                  <div>
                    <strong>{{ team.name }}</strong>
                    <p class="meta">
                      {{ roleLabel(team.role) }}
                      · {{ team._count?.members ?? 0 }} miembros
                      · {{ team._count?.retrospectives ?? 0 }} retros
                    </p>
                  </div>
                </a>
                <div class="row-actions">
                  @if (team.role) {
                    <button
                      type="button"
                      class="star-btn"
                      [class.on]="!!team.favorited"
                      (click)="toggleFavorite(team)"
                      [title]="team.favorited ? 'Quitar destacado' : 'Destacar'"
                    >
                      ★
                    </button>
                  }
                  @if (canManageTeam(team)) {
                    <button
                      type="button"
                      class="icon-action"
                      (click)="openEdit(team)"
                      title="Editar"
                      aria-label="Editar equipo"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      class="icon-action"
                      (click)="openInvite(team)"
                      title="Invitar"
                      aria-label="Invitar al equipo"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      class="icon-action danger"
                      (click)="confirmDelete(team)"
                      title="Borrar"
                      aria-label="Borrar equipo"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                        />
                      </svg>
                    </button>
                  }
                </div>
              </div>
            }
          </div>
        }
      </section>
    </div>

    @if (showCreate()) {
      <app-team-create-join-modal
        (close)="showCreate.set(false)"
        (created)="reload()"
      />
    }

    @if (editTeam(); as team) {
      <div class="backdrop" (click)="editTeam.set(null)">
        <div class="card modal" (click)="$event.stopPropagation()">
          <h2>Editar equipo</h2>

          <div class="logo-picker">
            <span class="logo-label">Logo</span>
            <div class="logo-preview-wrap">
              <div class="logo-preview" aria-hidden="true">
                @if (editLogoPreview()) {
                  <img [src]="editLogoPreview()!" alt="" />
                } @else if (team.logoUrl) {
                  <img [src]="team.logoUrl" alt="" />
                } @else {
                  <span>{{ editName.charAt(0) || '?' }}</span>
                }
              </div>
              <label
                class="logo-upload"
                title="Subir logo"
                aria-label="Subir logo"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
                  />
                </svg>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  (change)="onEditLogo($event)"
                />
              </label>
            </div>
            <span class="logo-hint">Click para cambiar</span>
            @if (editLogoFile()) {
              <button
                type="button"
                class="btn-ghost btn-sm"
                (click)="clearEditLogo()"
              >
                Quitar
              </button>
            }
          </div>

          <label class="field">
            <span>Nombre</span>
            <input type="text" [(ngModel)]="editName" name="editName" />
          </label>
          @if (modalError()) {
            <p class="form-error">{{ modalError() }}</p>
          }
          <div class="actions">
            <button type="button" class="btn-secondary" (click)="editTeam.set(null)">
              Cancelar
            </button>
            <button
              type="button"
              class="btn-primary"
              [disabled]="saving()"
              (click)="saveEdit()"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    }

    @if (inviteTeam(); as team) {
      <div class="backdrop" (click)="inviteTeam.set(null)">
        <div class="card modal" (click)="$event.stopPropagation()">
          <h2>Invitar a {{ team.name }}</h2>

          <div class="invite-block">
            <h3>Enlace</h3>
            <div class="copy-row">
              <code class="code">{{ inviteLink(team) }}</code>
              <button
                type="button"
                class="btn-secondary btn-sm"
                (click)="copyText(inviteLink(team), 'Enlace copiado')"
              >
                Copiar
              </button>
            </div>
          </div>

          <div class="invite-block">
            <h3>Email</h3>
            <label class="field">
              <span>Usuario registrado</span>
              <div class="invite-input-row">
                <input
                  type="email"
                  [(ngModel)]="inviteEmail"
                  name="inviteEmail"
                  (ngModelChange)="onInviteSearch($event)"
                  (keydown.enter)="$event.preventDefault(); submitInvite(team)"
                  placeholder="persona@empresa.com"
                />
                <button
                  type="button"
                  class="btn-primary btn-sm"
                  [disabled]="inviting() || !inviteEmail.trim()"
                  (click)="submitInvite(team)"
                >
                  {{ inviting() ? '…' : 'Invitar' }}
                </button>
              </div>
            </label>
            @if (inviteHits().length) {
              <ul class="hits">
                @for (hit of inviteHits(); track hit.id) {
                  <li>
                    <button type="button" class="hit" (click)="sendInvite(team, hit)">
                      <app-user-avatar
                        [avatarId]="hit.avatarId"
                        [seed]="hit.id"
                        [name]="hit.name"
                        size="sm"
                      />
                      <span>
                        <strong>{{ hit.name }}</strong>
                        <small>{{ hit.email }}</small>
                      </span>
                    </button>
                  </li>
                }
              </ul>
            }
          </div>

          <div class="invite-block">
            <h3>Código</h3>
            <div class="copy-row">
              <code class="code">{{ team.inviteCode }}</code>
              <button
                type="button"
                class="btn-secondary btn-sm"
                (click)="copyText(team.inviteCode, 'Código copiado')"
              >
                Copiar
              </button>
            </div>
          </div>

          @if (modalError()) {
            <p class="form-error">{{ modalError() }}</p>
          }
          <div class="actions">
            <button
              type="button"
              class="btn-secondary"
              (click)="inviteTeam.set(null)"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    }

    @if (deleteTeam(); as team) {
      <div class="backdrop" (click)="closeDelete()">
        <div class="card modal" (click)="$event.stopPropagation()">
          <h2>Borrar {{ team.name }}</h2>
          <p class="subtitle">
            Se borrarán retros, acciones y miembros. No se puede deshacer.
          </p>
          <label class="field">
            <span>Escribí <strong>{{ team.name }}</strong> para confirmar</span>
            <input
              type="text"
              [(ngModel)]="deleteConfirmName"
              name="deleteConfirmName"
              autocomplete="off"
              (keydown.enter)="$event.preventDefault(); doDelete(team)"
            />
          </label>
          @if (modalError()) {
            <p class="form-error">{{ modalError() }}</p>
          }
          <div class="actions">
            <button type="button" class="btn-secondary" (click)="closeDelete()">
              Cancelar
            </button>
            <button
              type="button"
              class="btn-danger"
              [disabled]="saving() || !canConfirmDelete(team)"
              (click)="doDelete(team)"
            >
              Borrar equipo
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .section {
      margin-bottom: 1.75rem;
    }
    .section h2 {
      margin: 0 0 0.75rem;
      font-size: 1.05rem;
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.85rem 1rem;
    }
    .row.pending {
      border-color: color-mix(in srgb, var(--color-brand) 35%, var(--color-border));
    }
    .team-id {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-width: 0;
      text-decoration: none;
      color: inherit;
      flex: 1;
    }
    .team-id:hover {
      text-decoration: none;
    }
    .team-logo {
      width: 2.4rem;
      height: 2.4rem;
      border-radius: 8px;
      background: var(--color-sky-soft);
      color: var(--color-brand);
      font-weight: 800;
      display: grid;
      place-items: center;
      overflow: hidden;
      flex-shrink: 0;
      text-transform: uppercase;
      border: 1px solid var(--color-border);
    }
    .team-logo.lg {
      width: 3rem;
      height: 3rem;
    }
    .team-logo img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .meta {
      margin: 0.15rem 0 0;
      color: var(--color-text-muted);
      font-size: 0.85rem;
    }
    .row-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      align-items: center;
    }
    .star-btn {
      appearance: none;
      border: none;
      background: transparent;
      color: var(--color-text-muted);
      font-size: 1.1rem;
      cursor: pointer;
      padding: 0.2rem 0.35rem;
    }
    .star-btn.on {
      color: #d4a017;
    }
    .icon-action {
      appearance: none;
      width: 2rem;
      height: 2rem;
      padding: 0;
      border: none;
      border-radius: 8px;
      display: grid;
      place-items: center;
      background: transparent;
      color: var(--color-brand);
      cursor: pointer;
    }
    .icon-action:hover {
      background: var(--color-sky-soft);
    }
    .icon-action.danger {
      color: var(--color-danger);
    }
    .icon-action.danger:hover {
      background: var(--color-danger-soft);
    }
    .icon-action svg {
      width: 1.15rem;
      height: 1.15rem;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.75;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .invite-block h3 {
      margin: 0 0 0.45rem;
      font-size: 0.8rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--color-text-muted);
    }
    .copy-row {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }
    .invite-input-row {
      display: flex;
      gap: 0.45rem;
      align-items: center;
    }
    .invite-input-row input {
      flex: 1;
      min-width: 0;
    }
    .code {
      flex: 1;
      min-width: 0;
      padding: 0.5rem 0.65rem;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      background: var(--color-bg-muted);
      font-size: 0.82rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 80;
      display: grid;
      place-items: center;
      padding: 1.25rem;
      background: var(--color-overlay);
      backdrop-filter: blur(4px);
    }
    .modal {
      width: min(420px, 100%);
      padding: 1.35rem;
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }
    .modal h2 {
      margin: 0;
      font-size: 1.15rem;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--color-text-muted);
    }
    .field input {
      font: inherit;
      font-weight: 500;
      color: var(--color-text);
      padding: 0.55rem 0.7rem;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      background: var(--color-bg);
    }
    .logo-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .logo-picker {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.4rem;
      padding: 0.15rem 0 0.25rem;
    }
    .logo-label {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--color-text-muted);
    }
    .logo-hint {
      font-size: 0.8rem;
      color: var(--color-text-muted);
    }
    .logo-preview-wrap {
      position: relative;
      width: 4.5rem;
      height: 4.5rem;
      flex-shrink: 0;
    }
    .logo-preview {
      width: 100%;
      height: 100%;
      border-radius: 12px;
      background: var(--color-sky-soft);
      color: var(--color-brand);
      font-weight: 800;
      font-size: 1.35rem;
      display: grid;
      place-items: center;
      overflow: hidden;
      border: 1px solid var(--color-border);
      text-transform: uppercase;
    }
    .logo-preview img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .logo-upload {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      border-radius: 12px;
      background: color-mix(in srgb, var(--color-text) 45%, transparent);
      color: #fff;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.12s ease;
    }
    .logo-preview-wrap:hover .logo-upload,
    .logo-upload:focus-within {
      opacity: 1;
    }
    .logo-upload svg {
      width: 1.25rem;
      height: 1.25rem;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.75;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .logo-upload input {
      position: absolute;
      inset: 0;
      opacity: 0;
      cursor: pointer;
    }
    .file-btn {
      position: relative;
      overflow: hidden;
      cursor: pointer;
    }
    .file-btn input {
      position: absolute;
      inset: 0;
      opacity: 0;
      cursor: pointer;
    }
    .hits {
      list-style: none;
      margin: 0;
      padding: 0;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      max-height: 10rem;
      overflow: auto;
    }
    .hit {
      appearance: none;
      width: 100%;
      display: flex;
      align-items: center;
      gap: 0.55rem;
      padding: 0.45rem 0.55rem;
      border: none;
      background: transparent;
      text-align: left;
      cursor: pointer;
      font: inherit;
      color: inherit;
    }
    .hit:hover {
      background: var(--color-sky-soft);
    }
    .hit span {
      display: flex;
      flex-direction: column;
    }
    .hit small {
      color: var(--color-text-muted);
      font-size: 0.78rem;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.55rem;
    }
  `,
})
export class TeamsPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly favorites = inject(FavoriteTeamsService);
  private readonly activeTeams = inject(ActiveTeamService);
  private readonly invites = inject(TeamInviteService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  teams = signal<TeamSummary[]>([]);
  incoming = signal<TeamInvite[]>([]);
  error = signal('');
  modalError = signal('');
  showCreate = signal(false);
  editTeam = signal<TeamSummary | null>(null);
  inviteTeam = signal<TeamSummary | null>(null);
  deleteTeam = signal<TeamSummary | null>(null);
  saving = signal(false);
  resolvingId = signal('');
  inviteHits = signal<UserSearchHit[]>([]);
  inviting = signal(false);
  editLogoFile = signal<File | null>(null);
  editLogoPreview = signal<string | null>(null);
  editName = '';
  inviteEmail = '';
  deleteConfirmName = '';
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      this.invites.changed();
      untracked(() => this.reloadIncoming());
    });
  }

  ngOnInit() {
    this.reload();
    this.reloadIncoming();
  }

  roleLabel(role?: string) {
    return role === 'facilitator' ? 'Facilitador' : role ? 'Miembro' : 'Admin';
  }

  canManageTeam(team: TeamSummary) {
    return !!this.auth.user()?.isAdmin || team.role === 'facilitator';
  }

  reload() {
    this.api.listTeams().subscribe({
      next: (teams) => this.teams.set(sortTeams(teams)),
      error: () => this.error.set('No se pudieron cargar los equipos'),
    });
    this.activeTeams.load();
  }

  reloadIncoming() {
    this.api.listIncomingTeamInvites().subscribe({
      next: (list) => this.incoming.set(list),
      error: () => this.incoming.set([]),
    });
  }

  toggleFavorite(team: TeamSummary) {
    const next = !team.favorited;
    const previousAt = team.favoritedAt;
    this.teams.update((list) => withFavorite(list, team.id, next));
    this.activeTeams.markFavorite(team.id, next);
    this.favorites.setFavorite(team.id, next, team.name).subscribe({
      next: () => this.reload(),
      error: (e) => {
        this.teams.update((list) =>
          withFavorite(list, team.id, !next, previousAt),
        );
        this.activeTeams.markFavorite(team.id, !next, previousAt);
        this.toast.error(httpErrorMessage(e, 'No se pudo actualizar'));
      },
    });
  }

  copyCode(team: TeamSummary) {
    this.copyText(team.inviteCode, 'Código copiado');
  }

  copyText(text: string, okMsg: string) {
    if (!text) return;
    void navigator.clipboard.writeText(text).then(
      () => this.toast.ok(okMsg),
      () => this.toast.error('No se pudo copiar'),
    );
  }

  inviteLink(team: TeamSummary) {
    if (typeof window === 'undefined') return `/join-team/${team.inviteCode}`;
    return `${window.location.origin}/join-team/${team.inviteCode}`;
  }

  openEdit(team: TeamSummary) {
    this.modalError.set('');
    this.editName = team.name;
    this.clearEditLogo();
    this.editTeam.set(team);
  }

  openInvite(team: TeamSummary) {
    this.modalError.set('');
    this.inviteEmail = '';
    this.inviteHits.set([]);
    this.inviteTeam.set(team);
  }

  confirmDelete(team: TeamSummary) {
    this.modalError.set('');
    this.deleteConfirmName = '';
    this.deleteTeam.set(team);
  }

  closeDelete() {
    this.deleteTeam.set(null);
    this.deleteConfirmName = '';
    this.modalError.set('');
  }

  canConfirmDelete(team: TeamSummary) {
    return this.deleteConfirmName.trim() === team.name;
  }

  onEditLogo(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const err = rejectImageFile(file, 'logo');
    if (err) {
      this.modalError.set(err);
      return;
    }
    this.clearEditLogo();
    this.editLogoFile.set(file);
    this.editLogoPreview.set(URL.createObjectURL(file));
  }

  clearEditLogo() {
    const prev = this.editLogoPreview();
    if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
    this.editLogoFile.set(null);
    this.editLogoPreview.set(null);
  }

  saveEdit() {
    const team = this.editTeam();
    if (!team || this.saving()) return;
    this.saving.set(true);
    this.modalError.set('');
    const name = this.editName.trim();
    const file = this.editLogoFile();
    const afterName = () => {
      if (!file) {
        this.saving.set(false);
        this.editTeam.set(null);
        this.reload();
        return;
      }
      this.api.uploadTeamLogo(team.id, file).subscribe({
        next: () => {
          this.saving.set(false);
          this.editTeam.set(null);
          this.clearEditLogo();
          this.reload();
        },
        error: (e) => {
          this.saving.set(false);
          this.modalError.set(httpErrorMessage(e, 'No se pudo subir el logo'));
        },
      });
    };
    if (name && name !== team.name) {
      this.api.updateTeam(team.id, { name }).subscribe({
        next: () => afterName(),
        error: (e) => {
          this.saving.set(false);
          this.modalError.set(httpErrorMessage(e, 'No se pudo guardar'));
        },
      });
    } else {
      afterName();
    }
  }

  onInviteSearch(value: string) {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    const q = value.trim();
    if (q.length < 3) {
      this.inviteHits.set([]);
      return;
    }
    this.searchTimer = setTimeout(() => {
      this.api.searchUsersByEmail(q).subscribe({
        next: (hits) => this.inviteHits.set(hits),
        error: () => this.inviteHits.set([]),
      });
    }, 250);
  }

  sendInvite(team: TeamSummary, hit: UserSearchHit) {
    if (this.inviting()) return;
    this.modalError.set('');
    this.inviting.set(true);
    this.api.inviteTeamMember(team.id, hit.email).subscribe({
      next: () => {
        this.inviting.set(false);
        this.toast.ok(`Invitación enviada a ${hit.name}`);
        this.inviteHits.set([]);
        this.inviteEmail = '';
      },
      error: (e) => {
        this.inviting.set(false);
        this.modalError.set(httpErrorMessage(e, 'No se pudo invitar'));
      },
    });
  }

  submitInvite(team: TeamSummary) {
    const q = this.inviteEmail.trim().toLowerCase();
    if (!q || this.inviting()) return;
    const hits = this.inviteHits();
    const exact = hits.find((h) => h.email.toLowerCase() === q);
    if (exact) {
      this.sendInvite(team, exact);
      return;
    }
    if (hits.length === 1) {
      this.sendInvite(team, hits[0]);
      return;
    }
    this.inviting.set(true);
    this.modalError.set('');
    this.api.searchUsersByEmail(q).subscribe({
      next: (found) => {
        const match =
          found.find((h) => h.email.toLowerCase() === q) ??
          (found.length === 1 ? found[0] : null);
        if (!match) {
          this.inviting.set(false);
          this.modalError.set('No hay un usuario registrado con ese email');
          this.inviteHits.set(found);
          return;
        }
        this.inviting.set(false);
        this.sendInvite(team, match);
      },
      error: () => {
        this.inviting.set(false);
        this.modalError.set('No se pudo buscar el usuario');
      },
    });
  }

  acceptInvite(invite: TeamInvite) {
    this.resolvingId.set(invite.id);
    this.invites.acceptById(invite.id).subscribe({
      next: (res) => {
        this.resolvingId.set('');
        this.reloadIncoming();
        this.activeTeams.enterTeam(res.teamId, res.teamName || invite.teamName);
      },
      error: () => {
        this.resolvingId.set('');
        this.toast.error('No se pudo aceptar');
      },
    });
  }

  rejectInvite(invite: TeamInvite) {
    this.resolvingId.set(invite.id);
    this.invites.rejectById(invite.id).subscribe({
      next: () => {
        this.resolvingId.set('');
        this.reloadIncoming();
      },
      error: () => {
        this.resolvingId.set('');
        this.toast.error('No se pudo rechazar');
      },
    });
  }

  doDelete(team: TeamSummary) {
    if (!this.canConfirmDelete(team) || this.saving()) return;
    this.saving.set(true);
    this.api.deleteTeam(team.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeDelete();
        if (this.activeTeams.activeTeamId() === team.id) {
          this.activeTeams.load();
          void this.router.navigate(['/dashboard']);
        }
        this.reload();
        this.toast.ok('Equipo borrado');
      },
      error: (e) => {
        this.saving.set(false);
        this.modalError.set(httpErrorMessage(e, 'No se pudo borrar'));
      },
    });
  }
}
