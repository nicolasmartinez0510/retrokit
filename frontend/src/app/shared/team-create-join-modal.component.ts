import {
  Component,
  HostListener,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ActiveTeamService } from '../core/active-team.service';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { rejectImageFile } from '../core/image-file';
import { httpErrorMessage } from '../core/http-error';
import { UserSearchHit } from '../core/models';
import { ToastService } from '../core/toast.service';
import { UserAvatarComponent } from './user-avatar.component';

type Tab = 'create' | 'join';

@Component({
  selector: 'app-team-create-join-modal',
  imports: [FormsModule, UserAvatarComponent],
  template: `
    <div
      class="backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="team-create-join-title"
      (click)="close.emit()"
    >
      <div class="card modal" (click)="$event.stopPropagation()">
        <div class="tabs">
          <button
            type="button"
            class="tab"
            [class.active]="tab() === 'create'"
            (click)="tab.set('create')"
          >
            Crear equipo
          </button>
          <button
            type="button"
            class="tab"
            [class.active]="tab() === 'join'"
            (click)="tab.set('join')"
          >
            Unirse
          </button>
        </div>

        @if (tab() === 'create') {
          <h2 id="team-create-join-title">Nuevo equipo</h2>

          <div class="logo-picker">
            <span class="logo-label">Logo</span>
            <div class="logo-preview-wrap">
              <div class="logo-preview" aria-hidden="true">
                @if (logoPreview()) {
                  <img [src]="logoPreview()!" alt="" />
                } @else {
                  <span>{{ name.trim().charAt(0) || '?' }}</span>
                }
              </div>
              <label class="logo-upload" title="Subir logo" aria-label="Subir logo">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
                  />
                </svg>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  (change)="onLogoPicked($event)"
                />
              </label>
            </div>
            <span class="logo-hint">{{
              logoFile() ? 'Click para cambiar' : 'Click para subir'
            }}</span>
            @if (logoFile()) {
              <button
                type="button"
                class="btn-ghost btn-sm"
                (click)="clearLogo()"
              >
                Quitar
              </button>
            }
          </div>

          <label class="field">
            <span>Nombre</span>
            <input
              type="text"
              [(ngModel)]="name"
              name="teamName"
              placeholder="Ej. Nimbus"
              autocomplete="off"
            />
          </label>

          <label class="field">
            <span>Invitar por email</span>
            <div class="invite-input-row">
              <input
                type="email"
                [(ngModel)]="emailQuery"
                name="inviteEmail"
                placeholder="persona@empresa.com"
                (ngModelChange)="onEmailQuery($event)"
                (keydown.enter)="$event.preventDefault(); tryAddInvitee()"
                autocomplete="off"
              />
              <button
                type="button"
                class="btn-secondary btn-sm"
                [disabled]="!emailQuery.trim()"
                (click)="tryAddInvitee()"
              >
                Agregar
              </button>
            </div>
          </label>
          @if (searchHits().length) {
            <ul class="hits">
              @for (hit of searchHits(); track hit.id) {
                <li>
                  <button type="button" class="hit" (click)="addInvitee(hit)">
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
          @if (invitees().length) {
            <div class="invitee-list">
              <p class="invitee-title">
                Invitados ({{ invitees().length }})
              </p>
              <ul>
                @for (u of invitees(); track u.id) {
                  <li class="invitee-row">
                    <app-user-avatar
                      [avatarId]="u.avatarId"
                      [seed]="u.id"
                      [name]="u.name"
                      size="sm"
                    />
                    <span class="invitee-meta">
                      <strong>{{ u.name }}</strong>
                      <small>{{ u.email }}</small>
                    </span>
                    <button
                      type="button"
                      class="chip-x"
                      (click)="removeInvitee(u.id)"
                      aria-label="Quitar"
                      title="Quitar"
                    >
                      ×
                    </button>
                  </li>
                }
              </ul>
            </div>
          }

          @if (error()) {
            <p class="form-error">{{ error() }}</p>
          }

          <div class="actions">
            <button type="button" class="btn-secondary" (click)="close.emit()">
              Cancelar
            </button>
            <button
              type="button"
              class="btn-primary"
              [disabled]="saving() || name.trim().length < 2"
              (click)="create()"
            >
              {{ saving() ? 'Creando…' : 'Crear equipo' }}
            </button>
          </div>
        } @else {
          <h2 id="team-create-join-title">Unirse a un equipo</h2>
          <label class="field">
            <span>Código de invitación</span>
            <input
              type="text"
              [(ngModel)]="inviteCode"
              name="inviteCode"
              placeholder="Código del equipo"
              autocomplete="off"
            />
          </label>
          @if (error()) {
            <p class="form-error">{{ error() }}</p>
          }
          <div class="actions">
            <button type="button" class="btn-secondary" (click)="close.emit()">
              Cancelar
            </button>
            <button
              type="button"
              class="btn-primary"
              [disabled]="saving() || inviteCode.trim().length < 4"
              (click)="join()"
            >
              {{ saving() ? 'Uniendo…' : 'Unirme' }}
            </button>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
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
      width: min(440px, 100%);
      padding: 1.25rem 1.35rem 1.2rem;
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }
    .tabs {
      display: flex;
      gap: 0.35rem;
      background: var(--color-bg-muted);
      padding: 0.25rem;
      border-radius: var(--radius-sm);
    }
    .tab {
      appearance: none;
      flex: 1;
      border: none;
      background: transparent;
      padding: 0.45rem 0.6rem;
      border-radius: 6px;
      font: inherit;
      font-weight: 650;
      font-size: 0.88rem;
      color: var(--color-text-muted);
      cursor: pointer;
    }
    .tab.active {
      background: var(--color-bg);
      color: var(--color-text);
      box-shadow: var(--shadow);
    }
    h2 {
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
    .invite-input-row {
      display: flex;
      gap: 0.45rem;
      align-items: center;
    }
    .invite-input-row input {
      flex: 1;
      min-width: 0;
    }
    .invitee-list {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    .invitee-title {
      margin: 0;
      font-size: 0.8rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--color-text-muted);
    }
    .invitee-list ul {
      list-style: none;
      margin: 0;
      padding: 0;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      max-height: 10rem;
      overflow: auto;
    }
    .invitee-row {
      display: flex;
      align-items: center;
      gap: 0.55rem;
      padding: 0.45rem 0.55rem;
      border-bottom: 1px solid var(--color-border);
    }
    .invitee-row:last-child {
      border-bottom: none;
    }
    .invitee-meta {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }
    .invitee-meta small {
      color: var(--color-text-muted);
      font-size: 0.78rem;
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
    .hits {
      list-style: none;
      margin: -0.35rem 0 0;
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
      min-width: 0;
    }
    .hit small {
      color: var(--color-text-muted);
      font-size: 0.78rem;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem 0.45rem;
      border-radius: 999px;
      background: var(--color-sky-soft);
      color: var(--color-brand);
      font-size: 0.8rem;
      font-weight: 650;
    }
    .chip-x {
      appearance: none;
      border: none;
      background: transparent;
      color: var(--color-text-muted);
      cursor: pointer;
      font-size: 1.15rem;
      line-height: 1;
      padding: 0 0.15rem;
      flex-shrink: 0;
    }
    .chip-x:hover {
      color: var(--color-danger);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.55rem;
      margin-top: 0.25rem;
    }
  `,
})
export class TeamCreateJoinModalComponent {
  private readonly api = inject(ApiService);
  private readonly activeTeams = inject(ActiveTeamService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly initialTab = input<Tab>('create');
  readonly close = output<void>();
  readonly created = output<string>();

  readonly tab = linkedSignal(() => this.initialTab());
  readonly saving = signal(false);
  readonly error = signal('');
  readonly searchHits = signal<UserSearchHit[]>([]);
  readonly invitees = signal<UserSearchHit[]>([]);
  readonly logoFile = signal<File | null>(null);
  readonly logoPreview = signal<string | null>(null);

  name = '';
  inviteCode = '';
  emailQuery = '';
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  @HostListener('document:keydown.escape')
  onEsc() {
    this.close.emit();
  }

  onEmailQuery(value: string) {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    const q = value.trim();
    if (q.length < 3) {
      this.searchHits.set([]);
      return;
    }
    this.searchTimer = setTimeout(() => {
      this.api.searchUsersByEmail(q).subscribe({
        next: (hits) => {
          const taken = new Set(this.invitees().map((u) => u.id));
          this.searchHits.set(hits.filter((h) => !taken.has(h.id)));
        },
        error: () => this.searchHits.set([]),
      });
    }, 250);
  }

  addInvitee(hit: UserSearchHit) {
    if (this.invitees().some((u) => u.id === hit.id)) return;
    this.invitees.update((list) => [...list, hit]);
    this.searchHits.set([]);
    this.emailQuery = '';
    this.error.set('');
  }

  tryAddInvitee() {
    const q = this.emailQuery.trim().toLowerCase();
    if (!q) return;
    const hits = this.searchHits();
    const exact = hits.find((h) => h.email.toLowerCase() === q);
    if (exact) {
      this.addInvitee(exact);
      return;
    }
    if (hits.length === 1) {
      this.addInvitee(hits[0]);
      return;
    }
    this.api.searchUsersByEmail(q).subscribe({
      next: (found) => {
        const taken = new Set(this.invitees().map((u) => u.id));
        const available = found.filter((h) => !taken.has(h.id));
        const match =
          available.find((h) => h.email.toLowerCase() === q) ??
          (available.length === 1 ? available[0] : null);
        if (match) {
          this.addInvitee(match);
        } else {
          this.error.set('No hay un usuario registrado con ese email');
          this.searchHits.set(available);
        }
      },
      error: () =>
        this.error.set('No se pudo buscar el usuario'),
    });
  }

  removeInvitee(id: string) {
    this.invitees.update((list) => list.filter((u) => u.id !== id));
  }

  onLogoPicked(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const err = rejectImageFile(file, 'logo');
    if (err) {
      this.error.set(err);
      return;
    }
    this.clearLogo();
    this.logoFile.set(file);
    this.logoPreview.set(URL.createObjectURL(file));
    this.error.set('');
  }

  clearLogo() {
    const prev = this.logoPreview();
    if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
    this.logoFile.set(null);
    this.logoPreview.set(null);
  }

  create() {
    const name = this.name.trim();
    if (name.length < 2 || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    const emails = this.invitees().map((u) => u.email);
    this.api.createTeam(name, emails).subscribe({
      next: (team) => {
        this.auth.markFacilitator();
        const file = this.logoFile();
        const finish = (id: string) => {
          this.activeTeams.load();
          this.activeTeams.setActive(id);
          this.saving.set(false);
          this.created.emit(id);
          this.close.emit();
          void this.router.navigate(['/dashboard']);
        };
        if (file) {
          this.api.uploadTeamLogo(team.id, file).subscribe({
            next: () => finish(team.id),
            error: (e) => {
              this.toast.error(
                httpErrorMessage(e, 'Equipo creado, pero falló el logo'),
              );
              finish(team.id);
            },
          });
        } else {
          finish(team.id);
        }
      },
      error: (e) => {
        this.saving.set(false);
        this.error.set(httpErrorMessage(e, 'No se pudo crear el equipo'));
      },
    });
  }

  join() {
    const code = this.inviteCode.trim();
    if (code.length < 4 || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    this.api.joinTeam(code).subscribe({
      next: (team) => {
        this.activeTeams.load();
        this.activeTeams.setActive(team.id);
        this.saving.set(false);
        this.created.emit(team.id);
        this.close.emit();
        void this.router.navigate(['/dashboard']);
      },
      error: (e) => {
        this.saving.set(false);
        this.error.set(httpErrorMessage(e, 'Código inválido'));
      },
    });
  }
}
