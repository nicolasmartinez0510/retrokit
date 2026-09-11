import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { PHASE_LABELS, TeamDetail, Template } from '../../core/models';

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

        @if (error() && !showCreateModal()) {
          <p class="form-error">{{ error() }}</p>
        }

        <section class="section">
          <h2>Miembros</h2>
          <div class="members">
            @for (m of t.members; track m.id) {
              <span class="badge">{{ m.user.name }} · {{ m.role }}</span>
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
                    class="btn-danger btn-sm"
                    (click)="deleteRetro(r.id, r.title)"
                  >
                    Borrar
                  </button>
                }
              </div>
            } @empty {
              <p class="empty-state">Todavía no hay retrospectivas.</p>
            }
          </div>
        </section>
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
  `,
  styles: `
    .header-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.65rem;
      align-items: center;
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
    .members { display: flex; flex-wrap: wrap; gap: 0.5rem; }
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
    .create-modal h2 {
      margin: 0;
      font-size: 1.15rem;
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
  private inviteCopyTimer: ReturnType<typeof setTimeout> | null = null;

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
    const userId = this.auth.user()?.id;
    if (!userId) return false;
    return this.team()?.members.some(
      (m) => m.user.id === userId && m.role === 'facilitator',
    );
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
    const id = this.route.snapshot.paramMap.get('id')!;
    this.api.getTeam(id).subscribe((t) => this.team.set(t));
    this.api.listTemplates().subscribe((t) => {
      this.templates.set(t);
      if (t[0]) {
        this.templateId = t[0].id;
        this.applyDefaults(t[0]);
      }
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
