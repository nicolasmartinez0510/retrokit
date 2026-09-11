import { Component, HostListener, OnInit, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { JoinRequestService } from '../../core/join-request.service';
import {
  PHASE_LABELS,
  TeamDetail,
  TeamJoinRequest,
  TeamMember,
  Template,
} from '../../core/models';

@Component({
  selector: 'app-team-page',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="page">
      @if (team(); as t) {
        <div class="page-header">
          <div>
            <h1>{{ t.name }}</h1>
            <p class="subtitle">
              Código de equipo:
              <strong>{{ t.inviteCode }}</strong>
            </p>
          </div>
          <div class="header-actions">
            <button
              type="button"
              class="btn-primary"
              (click)="openCreateModal()"
            >
              <svg class="plus-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 4.5a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V5.25A.75.75 0 0 1 12 4.5Z"
                />
              </svg>
              Nueva retrospectiva
            </button>
            <a class="btn-secondary" [routerLink]="['/teams', t.id, 'actions']"
              >Tablero de acciones</a
            >
          </div>
        </div>

        <section class="card panel invite-panel">
          <h2>Invitar miembros</h2>
          <p class="invite-hint">
            Compartí este enlace para que se sumen al equipo (con cuenta). También
            pueden pegar el código en el panel.
          </p>
          <div class="invite-row">
            <code>{{ teamInviteUrl(t.inviteCode) }}</code>
            <button
              type="button"
              class="btn-secondary btn-sm"
              [class.copied]="inviteCopied()"
              (click)="copyTeamInvite(t.inviteCode)"
            >
              {{ inviteCopied() ? 'Copiado' : 'Copiar enlace' }}
            </button>
          </div>
        </section>

        @if (reminder()) {
          <div class="card reminder">
            Hay {{ reminder() }} acciones pendientes de retros anteriores.
          </div>
        }

        @if (error() && !showCreateModal() && !showDeleteModal()) {
          <p class="form-error">{{ error() }}</p>
        }

        <section class="section">
          <h2>Miembros</h2>
          <div class="member-list">
            @for (req of t.joinRequests ?? []; track req.id) {
              <div class="card member-row pending-member">
                <div class="member-info">
                  <strong>{{ req.user.name }}</strong>
                  <span class="badge">Nuevo · pendiente</span>
                </div>
                @if (isFacilitator()) {
                  <div class="member-actions">
                    <button
                      type="button"
                      class="btn-primary btn-sm"
                      [disabled]="resolvingRequestId() === req.id"
                      (click)="acceptJoin(req)"
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      class="btn-danger btn-sm"
                      [disabled]="resolvingRequestId() === req.id"
                      (click)="rejectJoin(req)"
                    >
                      Rechazar
                    </button>
                  </div>
                }
              </div>
            }
            @for (m of t.members; track m.id) {
              <div class="card member-row">
                <div class="member-info">
                  <strong>{{ m.user.name }}</strong>
                  <span class="badge">{{ roleLabel(m.role) }}</span>
                </div>
                @if (isFacilitator() && m.user.id !== currentUserId()) {
                  <button
                    type="button"
                    class="btn-danger btn-sm"
                    (click)="removeMember(m)"
                  >
                    Sacar
                  </button>
                }
              </div>
            }
          </div>
        </section>

        <section class="section">
          <h2>Historial</h2>
          <div class="retro-list">
            @for (r of t.retrospectives; track r.id) {
              <div class="card retro-row">
                <a [routerLink]="['/retros', r.id]">
                  <strong>{{ r.title }}</strong>
                  <span class="badge">{{ phaseLabel(r.status) }}</span>
                </a>
                @if (isFacilitator()) {
                  <button
                    type="button"
                    class="icon-btn trash"
                    title="Borrar"
                    aria-label="Borrar retrospectiva"
                    (click)="deleteRetro(r.id, r.title)"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                      />
                    </svg>
                  </button>
                }
              </div>
            } @empty {
              <p class="empty-state">Todavía no hay retrospectivas.</p>
            }
          </div>
        </section>

        @if (isFacilitator()) {
          <section class="card panel danger-panel">
            <h2>Zona de peligro</h2>
            <p class="danger-hint">
              Borrar el equipo elimina retrospectivas, miembros y acciones. No se
              puede deshacer.
            </p>
            <button type="button" class="btn-danger" (click)="openDeleteModal()">
              Borrar equipo
            </button>
          </section>
        }
      }
    </div>

    @if (showCreateModal()) {
      <div
        class="modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-retro-title"
        (click)="closeCreateModal()"
      >
        <div class="card create-modal" (click)="$event.stopPropagation()">
          <h2 id="create-retro-title">Nueva retrospectiva</h2>
          <form class="create-form" (ngSubmit)="createRetro()">
            <div class="field">
              <label>Título</label>
              <input [(ngModel)]="title" name="title" required />
            </div>
            <div class="field">
              <label>Plantilla</label>
              <select
                [ngModel]="templateId"
                (ngModelChange)="onTemplateChange($event)"
                name="templateId"
                required
              >
                @for (tpl of templates(); track tpl.id) {
                  <option [value]="tpl.id">{{ tpl.name }}</option>
                }
              </select>
              @if (selectedTemplate(); as tpl) {
                <p class="template-hint">{{ tpl.description }}</p>
                <ul class="template-cols">
                  @for (col of tpl.columns; track col.id) {
                    <li>
                      @if (col.logoUrl) {
                        <img class="col-logo-sm" [src]="col.logoUrl" alt="" />
                      }
                      <strong>{{ col.icon }} {{ col.title }}</strong>
                      @if (col.description) {
                        — {{ col.description }}
                      }
                    </li>
                  }
                </ul>
              }
            </div>
            <div class="settings-grid">
              <div class="field">
                <label>Máx. comentarios / persona</label>
                <input
                  type="number"
                  [(ngModel)]="maxComments"
                  name="maxComments"
                  min="1"
                />
              </div>
              <div class="field">
                <label>Votos por persona</label>
                <input
                  type="number"
                  [(ngModel)]="votesPerParticipant"
                  name="votes"
                  min="1"
                />
              </div>
              <div class="field">
                <label>Máx. votos por tarjeta</label>
                <input
                  type="number"
                  [(ngModel)]="maxVotesPerCard"
                  name="maxVotes"
                  min="1"
                />
              </div>
              <div class="field">
                <label>Timer por defecto</label>
                <select [(ngModel)]="timerSeconds" name="timerSeconds">
                  <option [ngValue]="300">5 min</option>
                  <option [ngValue]="600">10 min</option>
                  <option [ngValue]="900">15 min</option>
                </select>
              </div>
            </div>
            <label class="check">
              <input type="checkbox" [(ngModel)]="allowAnonymous" name="anon" />
              Permitir comentarios anónimos
            </label>
            @if (error()) {
              <p class="form-error">{{ error() }}</p>
            }
            <div class="modal-actions">
              <button
                type="button"
                class="btn-ghost"
                (click)="closeCreateModal()"
              >
                Cancelar
              </button>
              <button class="btn-primary" type="submit">Crear retrospectiva</button>
            </div>
          </form>
        </div>
      </div>
    }

    @if (showDeleteModal()) {
      <div
        class="modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-team-title"
        (click)="closeDeleteModal()"
      >
        <div class="card delete-modal" (click)="$event.stopPropagation()">
          <h2 id="delete-team-title">Borrar equipo</h2>
          <p class="danger-hint">
            Se eliminarán retrospectivas, miembros y acciones. Para confirmar,
            escribí el nombre del equipo:
            <strong>{{ team()?.name }}</strong>
          </p>
          <form class="delete-form" (ngSubmit)="confirmDeleteTeam()">
            <div class="field">
              <label for="delete-team-name">Nombre del equipo</label>
              <input
                id="delete-team-name"
                name="deleteTeamName"
                [(ngModel)]="deleteNameConfirm"
                autocomplete="off"
              />
            </div>
            @if (error()) {
              <p class="form-error">{{ error() }}</p>
            }
            <div class="modal-actions">
              <button
                type="button"
                class="btn-ghost"
                (click)="closeDeleteModal()"
              >
                Cancelar
              </button>
              <button
                class="btn-danger"
                type="submit"
                [disabled]="!canConfirmDelete() || deletingTeam()"
              >
                Borrar equipo
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
  styles: `
    .header-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.65rem;
      align-items: center;
    }
    .plus-icon {
      width: 1.05em;
      height: 1.05em;
      display: block;
      flex-shrink: 0;
      fill: currentColor;
    }
    .panel { padding: 1.25rem; margin-bottom: 1.5rem; }
    .create-form { display: flex; flex-direction: column; gap: 0.85rem; margin-top: 0.85rem; }
    .settings-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 0.75rem;
    }
    .check { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; }
    .template-hint {
      margin-top: 0.35rem;
      font-size: 0.85rem;
      color: var(--color-text-muted);
    }
    .template-cols {
      margin: 0.5rem 0 0;
      padding-left: 1.1rem;
      font-size: 0.8rem;
      color: var(--color-text-muted);
      li { margin-bottom: 0.25rem; }
      strong { color: var(--color-text); }
    }
    .col-logo-sm {
      width: 18px;
      height: 18px;
      object-fit: contain;
      vertical-align: middle;
      margin-right: 0.25rem;
    }
    .section { margin-bottom: 1.5rem; h2 { margin-bottom: 0.75rem; font-size: 1.1rem; } }
    .member-list { display: flex; flex-direction: column; gap: 0.5rem; }
    .member-row {
      padding: 0.75rem 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.75rem;
    }
    .pending-member {
      opacity: 0.7;
    }
    .member-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }
    .member-info {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      min-width: 0;
    }
    .danger-panel {
      padding: 1.15rem 1.25rem;
      border-color: var(--color-danger);
      h2 { margin: 0 0 0.4rem; font-size: 1.05rem; }
    }
    .danger-hint {
      margin: 0 0 0.85rem;
      color: var(--color-text-muted);
      font-size: 0.9rem;
      line-height: 1.4;
    }
    .retro-list { display: flex; flex-direction: column; gap: 0.6rem; }
    .retro-row {
      padding: 0.9rem 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.75rem;
      a {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.75rem;
        flex: 1;
        text-decoration: none;
        color: inherit;
        min-width: 0;
      }
    }
    .icon-btn {
      appearance: none;
      flex-shrink: 0;
      width: 1.85rem;
      height: 1.85rem;
      padding: 0;
      border-radius: 8px;
      display: grid;
      place-items: center;
      background: transparent;
      border: 1.5px solid transparent;
      cursor: pointer;
      color: var(--color-danger);
      svg {
        width: 1.1rem;
        height: 1.1rem;
        display: block;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.75;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      &.trash:hover {
        background: var(--color-danger-soft);
      }
    }
    .reminder {
      padding: 0.85rem 1rem;
      margin-bottom: 1rem;
      background: var(--color-sky-soft);
      border-color: var(--color-sky-mid);
      color: var(--color-brand);
      font-weight: 600;
    }
    .invite-panel {
      padding: 1.15rem 1.25rem;
      margin-bottom: 1.25rem;
      h2 { margin: 0 0 0.4rem; font-size: 1.05rem; }
    }
    .invite-hint {
      margin: 0 0 0.85rem;
      color: var(--color-text-muted);
      font-size: 0.9rem;
      line-height: 1.4;
    }
    .invite-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 0.65rem;
      align-items: center;
      code {
        font-size: 0.8rem;
        word-break: break-all;
        background: var(--color-bg-muted);
        padding: 0.55rem 0.7rem;
        border-radius: var(--radius);
      }
      .copied {
        background: var(--color-brand);
        color: var(--color-on-brand);
        border-color: var(--color-brand);
      }
    }
    .modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 60;
      display: grid;
      place-items: center;
      padding: 1.25rem;
      background: var(--color-overlay);
      backdrop-filter: blur(4px);
    }
    .create-modal {
      width: min(720px, 100%);
      max-height: min(90vh, 900px);
      overflow: auto;
      padding: 1.35rem 1.4rem 1.25rem;
    }
    .create-modal h2,
    .delete-modal h2 {
      margin: 0;
      font-size: 1.15rem;
    }
    .delete-modal {
      width: min(460px, 100%);
      padding: 1.35rem 1.4rem 1.25rem;
    }
    .delete-form {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      margin-top: 0.85rem;
    }
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: 0.65rem;
    }
    @media (max-width: 640px) {
      .invite-row { grid-template-columns: 1fr; }
    }
  `,
})
export class TeamPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly joinRequests = inject(JoinRequestService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  team = signal<TeamDetail | null>(null);
  templates = signal<Template[]>([]);
  title = '';
  templateId = '';
  maxComments: number | null = 3;
  votesPerParticipant = 5;
  maxVotesPerCard = 2;
  timerSeconds = 300;
  allowAnonymous = true;
  error = signal('');
  reminder = signal<number | null>(null);
  inviteCopied = signal(false);
  showCreateModal = signal(false);
  showDeleteModal = signal(false);
  deletingTeam = signal(false);
  deleteNameConfirm = '';
  resolvingRequestId = signal('');
  private inviteCopyTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const version = this.joinRequests.changed();
      if (version === 0) return;
      untracked(() => this.reloadTeam());
    });
  }

  phaseLabel = (s: keyof typeof PHASE_LABELS) => PHASE_LABELS[s];

  selectedTemplate() {
    return this.templates().find((t) => t.id === this.templateId) ?? null;
  }

  onTemplateChange(id: string) {
    this.templateId = id;
    this.applyDefaults(this.selectedTemplate());
  }

  applyDefaults(tpl: Template | null) {
    if (!tpl) return;
    this.maxComments = tpl.maxCommentsPerParticipant ?? null;
    this.votesPerParticipant = tpl.votesPerParticipant ?? 5;
    this.maxVotesPerCard = tpl.maxVotesPerCard ?? 2;
  }

  isFacilitator() {
    const userId = this.currentUserId();
    if (!userId) return false;
    return this.team()?.members.some(
      (m) => m.user.id === userId && m.role === 'facilitator',
    );
  }

  currentUserId() {
    return this.auth.user()?.id;
  }

  roleLabel(role: string) {
    return role === 'facilitator' ? 'Facilitador' : 'Miembro';
  }

  removeMember(member: TeamMember) {
    const team = this.team();
    if (!team) return;
    if (
      !confirm(
        `¿Sacar a ${member.user.name} del equipo? Si no pertenece a otro equipo, se borrará su cuenta.`,
      )
    ) {
      return;
    }
    this.error.set('');
    this.api.removeTeamMember(team.id, member.user.id).subscribe({
      next: () => {
        const current = this.team();
        if (!current) return;
        this.team.set({
          ...current,
          members: current.members.filter((m) => m.id !== member.id),
        });
      },
      error: (e) =>
        this.error.set(e?.error?.message || 'No se pudo sacar al miembro'),
    });
  }

  openDeleteModal() {
    this.error.set('');
    this.deleteNameConfirm = '';
    this.deletingTeam.set(false);
    this.showDeleteModal.set(true);
    queueMicrotask(() =>
      document.getElementById('delete-team-name')?.focus(),
    );
  }

  closeDeleteModal() {
    this.showDeleteModal.set(false);
    this.deleteNameConfirm = '';
    this.deletingTeam.set(false);
  }

  canConfirmDelete() {
    return this.deleteNameConfirm.trim() === (this.team()?.name ?? '');
  }

  confirmDeleteTeam() {
    const team = this.team();
    if (!team || !this.canConfirmDelete() || this.deletingTeam()) return;
    this.error.set('');
    this.deletingTeam.set(true);
    this.api.deleteTeam(team.id).subscribe({
      next: () => {
        this.auth.refreshProfile().subscribe(() => {
          void this.router.navigate(['/dashboard']);
        });
      },
      error: (e) => {
        this.deletingTeam.set(false);
        this.error.set(e?.error?.message || 'No se pudo borrar el equipo');
      },
    });
  }

  teamInviteUrl(inviteCode: string) {
    return `${window.location.origin}/join-team/${inviteCode}`;
  }

  openCreateModal() {
    this.error.set('');
    this.showCreateModal.set(true);
  }

  closeCreateModal() {
    this.showCreateModal.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.showDeleteModal()) {
      this.closeDeleteModal();
      return;
    }
    if (this.showCreateModal()) this.closeCreateModal();
  }

  async copyTeamInvite(inviteCode: string) {
    try {
      await navigator.clipboard.writeText(this.teamInviteUrl(inviteCode));
      this.inviteCopied.set(true);
    } catch {
      this.inviteCopied.set(false);
      this.error.set('No se pudo copiar el enlace');
      return;
    }
    if (this.inviteCopyTimer) clearTimeout(this.inviteCopyTimer);
    this.inviteCopyTimer = setTimeout(() => this.inviteCopied.set(false), 2200);
  }

  deleteRetro(id: string, title: string) {
    if (
      !confirm(
        `¿Borrar la retrospectiva “${title}”? Esta acción no se puede deshacer.`,
      )
    ) {
      return;
    }
    this.api.deleteRetro(id).subscribe({
      next: () => {
        const current = this.team();
        if (!current) return;
        this.team.set({
          ...current,
          retrospectives: current.retrospectives.filter((r) => r.id !== id),
        });
      },
      error: (e) =>
        this.error.set(e?.error?.message || 'No se pudo borrar la retrospectiva'),
    });
  }

  ngOnInit() {
    this.reloadTeam();
    this.api.listTemplates().subscribe((t) => {
      this.templates.set(t);
      if (t[0]) {
        this.templateId = t[0].id;
        this.applyDefaults(t[0]);
      }
    });
  }

  reloadTeam() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.api.getTeam(id).subscribe((t) => this.team.set(t));
  }

  acceptJoin(request: TeamJoinRequest) {
    const team = this.team();
    if (!team || this.resolvingRequestId()) return;
    this.error.set('');
    this.resolvingRequestId.set(request.id);
    this.api.acceptJoinRequest(team.id, request.id).subscribe({
      next: () => {
        this.resolvingRequestId.set('');
        this.reloadTeam();
      },
      error: (e) => {
        this.resolvingRequestId.set('');
        this.error.set(e?.error?.message || 'No se pudo confirmar');
      },
    });
  }

  rejectJoin(request: TeamJoinRequest) {
    const team = this.team();
    if (!team || this.resolvingRequestId()) return;
    this.error.set('');
    this.resolvingRequestId.set(request.id);
    this.api.rejectJoinRequest(team.id, request.id).subscribe({
      next: () => {
        this.resolvingRequestId.set('');
        this.reloadTeam();
      },
      error: (e) => {
        this.resolvingRequestId.set('');
        this.error.set(e?.error?.message || 'No se pudo rechazar');
      },
    });
  }

  createRetro() {
    const team = this.team();
    if (!team) return;
    this.api
      .createRetro({
        teamId: team.id,
        templateId: this.templateId,
        title: this.title,
        maxCommentsPerParticipant: this.maxComments,
        votesPerParticipant: this.votesPerParticipant,
        maxVotesPerCard: this.maxVotesPerCard,
        allowAnonymous: this.allowAnonymous,
        timerSeconds: this.timerSeconds,
      })
      .subscribe({
        next: (retro) => {
          if (retro.openActionsReminder) {
            this.reminder.set(retro.openActionsReminder);
          }
          this.closeCreateModal();
          void this.router.navigate(['/retros', retro.id]);
        },
        error: (e) => this.error.set(e?.error?.message || 'Error al crear'),
      });
  }
}
