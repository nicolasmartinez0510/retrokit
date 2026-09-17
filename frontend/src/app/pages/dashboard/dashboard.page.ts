import { Component, OnInit, effect, inject, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ActiveTeamService } from '../../core/active-team.service';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { daysUntilDue, dueUrgencyLabel, formatDueDate } from '../../core/dates';
import {
  ACTION_STATUS_LABELS,
  ActionItem,
  RetroSummary,
} from '../../core/models';
import { TeamCreateJoinModalComponent } from '../../shared/team-create-join-modal.component';
import { UserAvatarComponent } from '../../shared/user-avatar.component';

@Component({
  selector: 'app-dashboard-page',
  imports: [RouterLink, UserAvatarComponent, TeamCreateJoinModalComponent],
  template: `
    <div class="page">
      @if (!activeTeams.ready()) {
        <div class="empty-state card">Cargando…</div>
      } @else if (!activeTeams.hasTeams()) {
        @if (isAdmin()) {
          <div class="onboarding">
            <div class="onboarding-card card">
              <h1>Administración</h1>
              <p class="subtitle">
                Todavía no hay equipos. Usá Equipos y Usuarios en la barra para
                administrar la plataforma.
              </p>
              <div class="onboarding-actions">
                <a class="btn-primary" routerLink="/teams">Ir a Equipos</a>
                <a class="btn-secondary" routerLink="/users">Ir a Usuarios</a>
              </div>
            </div>
          </div>
        } @else {
          <div class="onboarding">
            <div class="onboarding-card card">
              <h1>Bienvenido a Retrokit</h1>
              <p class="subtitle">
                Creá un equipo o unite con un código para empezar a facilitar
                retrospectivas.
              </p>
              <div class="onboarding-actions">
                <button
                  type="button"
                  class="btn-primary"
                  (click)="openModal('create')"
                >
                  Crear equipo
                </button>
                <button
                  type="button"
                  class="btn-secondary"
                  (click)="openModal('join')"
                >
                  Unirme a un equipo
                </button>
              </div>
            </div>
          </div>
        }
      } @else {
        <div class="page-header">
          <div>
            @if (activeTeams.activeTeam(); as team) {
              <h1>{{ team.name }}</h1>
              <p class="subtitle">Retros recientes y acciones por caducar</p>
            } @else {
              <h1>Panel</h1>
              <p class="subtitle">Elegí un equipo en la barra lateral</p>
            }
          </div>
        </div>

        @if (error()) {
          <p class="form-error">{{ error() }}</p>
        }

        @if (!activeTeams.activeTeamId()) {
          <div class="empty-state card">
            <strong>Sin equipo activo</strong>
            Elegí un equipo en el selector de la barra lateral.
          </div>
        } @else {
          <div class="split">
            <section class="section">
              <h2>Retros recientes</h2>
              <div class="stack">
                @for (r of recentRetros(); track r.id) {
                  <a
                    class="card item-card"
                    [routerLink]="['/retros', r.id]"
                    [state]="{ returnTo: '/dashboard' }"
                  >
                    <div>
                      <strong>{{ r.title }}</strong>
                      <span class="muted">{{ r.createdAtLabel }}</span>
                    </div>
                    <span class="badge">{{ r.phaseLabel }}</span>
                  </a>
                } @empty {
                  <div class="empty-state card compact">
                    Sin retrospectivas todavía
                  </div>
                }
              </div>
            </section>
            <section class="section">
              <h2>Por caducar</h2>
              <div class="stack">
                @for (a of expiringActions(); track a.id) {
                  <a
                    class="card item-card due-card"
                    [routerLink]="['/teams', teamId()!, 'actions']"
                    [queryParams]="actionBoardParams(a)"
                  >
                    <div>
                      <strong>{{ a.title }}</strong>
                      <span class="muted owner-line">
                        @if (a.owner) {
                          <app-user-avatar
                            [avatarId]="a.owner.avatarId"
                            [ownerId]="a.owner.id"
                            [seed]="a.owner.id"
                            [name]="a.owner.name"
                            size="sm"
                          />
                          {{ a.owner.name }}
                        } @else {
                          Sin asignar
                        }
                        @if (a.retro?.title) {
                          <span class="due-sep">·</span>
                          {{ a.retro.title }}
                        }
                      </span>
                    </div>
                    <div class="due-meta">
                      <span class="badge">{{ statusLabel(a.status) }}</span>
                      <span class="due-badge" [class.overdue]="isOverdue(a)">
                        {{ urgencyLabel(a.dueDate) }}
                      </span>
                      @if (dueDateLabel(a.dueDate)) {
                        <span class="due-date">{{ dueDateLabel(a.dueDate) }}</span>
                      }
                    </div>
                  </a>
                } @empty {
                  <div class="empty-state card compact">
                    No hay acciones por vencer en los próximos 14 días
                  </div>
                }
              </div>
            </section>
          </div>
        }
      }
    </div>

    @if (showModal()) {
      <app-team-create-join-modal
        [initialTab]="modalTab()"
        (close)="showModal.set(false)"
        (created)="onTeamReady()"
      />
    }
  `,
  styles: `
    .onboarding {
      display: grid;
      place-items: center;
      min-height: min(70vh, 32rem);
      padding: 1.5rem 0;
    }
    .onboarding-card {
      width: min(28rem, 100%);
      padding: 1.75rem 1.5rem;
      text-align: center;
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }
    .onboarding-card h1 {
      margin: 0;
      font-size: 1.55rem;
    }
    .onboarding-card .subtitle {
      margin: 0;
    }
    .onboarding-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 0.65rem;
      margin-top: 0.5rem;
    }
    .section {
      margin-bottom: 1.5rem;
    }
    .section > h2 {
      font-size: 1.1rem;
      margin-bottom: 0.75rem;
    }
    .split {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.25rem;
      align-items: start;
    }
    .split .section {
      margin-bottom: 0;
    }
    @media (max-width: 800px) {
      .split {
        grid-template-columns: 1fr;
      }
    }
    .stack {
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
    }
    .item-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.75rem;
      padding: 0.85rem 1.1rem;
      text-decoration: none;
      color: inherit;
    }
    .item-card:hover {
      text-decoration: none;
    }
    .item-card strong {
      display: block;
    }
    .due-card {
      align-items: flex-start;
    }
    .muted {
      color: var(--color-text-muted);
      font-size: 0.85rem;
    }
    .owner-line {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.35rem;
      margin-top: 0.15rem;
    }
    .due-sep {
      opacity: 0.65;
    }
    .due-meta {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.25rem;
      flex-shrink: 0;
    }
    .due-badge {
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--color-brand);
    }
    .due-badge.overdue {
      color: var(--color-danger);
    }
    .due-date {
      font-size: 0.75rem;
      color: var(--color-text-muted);
    }
    .empty-state.compact {
      display: grid;
      place-items: center;
      min-height: 3.5rem;
      padding: 1.25rem;
    }
  `,
})
export class DashboardPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly activeTeams = inject(ActiveTeamService);

  recentRetros = signal<
    {
      id: string;
      title: string;
      phaseLabel: string;
      createdAt: string;
      createdAtLabel: string;
    }[]
  >([]);
  expiringActions = signal<ActionItem[]>([]);
  teamId = signal<string | null>(null);
  error = signal('');
  showModal = signal(false);
  modalTab = signal<'create' | 'join'>('create');

  private readonly dueSoonDays = 14;

  isAdmin() {
    return !!this.auth.user()?.isAdmin;
  }

  constructor() {
    effect(() => {
      const ready = this.activeTeams.ready();
      const hasTeams = this.activeTeams.hasTeams();
      const admin = this.isAdmin();
      untracked(() => {
        if (ready && !hasTeams && admin) {
          void this.router.navigate(['/teams']);
        }
      });
    });

    effect(() => {
      const id = this.activeTeams.activeTeamId();
      const ready = this.activeTeams.ready();
      const hasTeams = this.activeTeams.hasTeams();
      untracked(() => {
        if (!ready || !hasTeams) {
          this.recentRetros.set([]);
          this.expiringActions.set([]);
          this.error.set('');
          return;
        }
        this.reload(id);
      });
    });
  }

  ngOnInit() {
    if (this.activeTeams.ready() && this.activeTeams.hasTeams()) {
      this.reload(this.activeTeams.activeTeamId());
    }
  }

  openModal(tab: 'create' | 'join') {
    this.modalTab.set(tab);
    this.showModal.set(true);
  }

  onTeamReady() {
    this.showModal.set(false);
    this.activeTeams.load();
  }

  retroPhaseLabel(r: RetroSummary) {
    if (r.closed || r.closedAt) return 'Cerrada';
    return r.currentPhaseName || r.currentPhase?.name || '—';
  }

  statusLabel(status: ActionItem['status']) {
    return ACTION_STATUS_LABELS[status];
  }

  isOverdue(action: ActionItem) {
    const days = daysUntilDue(action.dueDate);
    return days !== null && days < 0;
  }

  urgencyLabel(iso?: string | null) {
    return dueUrgencyLabel(iso);
  }

  dueDateLabel(iso?: string | null) {
    return formatDueDate(iso);
  }

  actionBoardParams(action: ActionItem) {
    return { retro: action.retroId || '__none__' };
  }

  private reload(teamId: string | null) {
    this.teamId.set(teamId);
    this.error.set('');
    if (!teamId) {
      this.recentRetros.set([]);
      this.expiringActions.set([]);
      return;
    }

    forkJoin({
      team: this.api.getTeam(teamId).pipe(catchError(() => of(null))),
      actions: this.api
        .listActions(teamId)
        .pipe(catchError(() => of([] as ActionItem[]))),
    }).subscribe({
      next: ({ team, actions }) => {
        if (!team) {
          this.recentRetros.set([]);
          this.expiringActions.set([]);
          this.error.set('');
          this.activeTeams.invalidateActive();
          return;
        }
        const retros = [...(team.retrospectives || [])]
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          )
          .slice(0, 5)
          .map((r) => ({
            id: r.id,
            title: r.title,
            phaseLabel: this.retroPhaseLabel(r),
            createdAt: r.createdAt,
            createdAtLabel: formatCreatedAt(r.createdAt),
          }));
        this.recentRetros.set(retros);
        const userId = this.auth.user()?.id;
        const canSeeAllActions =
          !!this.auth.user()?.isAdmin ||
          (!!userId &&
            team.members.some(
              (m) => m.user.id === userId && m.role === 'facilitator',
            ));
        this.expiringActions.set(
          actions
            .filter((a) => a.status === 'pending' || a.status === 'doing')
            .filter((a) => {
              const days = daysUntilDue(a.dueDate);
              return days !== null && days <= this.dueSoonDays;
            })
            .filter((a) => canSeeAllActions || (!!userId && a.ownerId === userId))
            .sort(
              (a, b) =>
                (daysUntilDue(a.dueDate) ?? 0) - (daysUntilDue(b.dueDate) ?? 0),
            ),
        );
      },
      error: () => this.error.set('No se pudo cargar el panel'),
    });
  }
}

function formatCreatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
