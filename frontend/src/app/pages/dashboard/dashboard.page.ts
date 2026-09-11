import { Component, OnInit, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { JoinRequestService } from '../../core/join-request.service';
import { ActionItem, PHASE_LABELS, TeamSummary } from '../../core/models';

@Component({
  selector: 'app-dashboard-page',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Panel</h1>
          <p class="subtitle">Equipos, retros recientes y acciones pendientes</p>
        </div>
      </div>

      @if (error()) {
        <p class="form-error">{{ error() }}</p>
      }

      <section class="section">
        <div class="section-heading">
          <h2>Equipos</h2>
          <button
            type="button"
            class="btn-secondary btn-sm"
            [attr.aria-expanded]="teamFormsOpen()"
            (click)="toggleTeamForms()"
          >
            <svg class="plus-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 4.5a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V5.25A.75.75 0 0 1 12 4.5Z"
              />
            </svg>
            Nuevo
          </button>
        </div>
        @if (teamFormsOpen()) {
          <div class="grid-actions">
            <form class="card panel" (ngSubmit)="createTeam()">
              <h2>Crear equipo</h2>
              <div class="field">
                <label>Nombre del equipo</label>
                <input [(ngModel)]="newTeamName" name="newTeamName" required />
              </div>
              <button class="btn-primary" type="submit">Crear</button>
            </form>
            <form class="card panel" (ngSubmit)="joinTeam()">
              <h2>Unirse con código</h2>
              <div class="field">
                <label>Código de invitación</label>
                <input [(ngModel)]="joinCode" name="joinCode" required />
              </div>
              <button class="btn-secondary" type="submit">Unirme</button>
            </form>
          </div>
        }
        <div class="team-list">
          @for (team of teams(); track team.id) {
            <a class="card team-card" [routerLink]="['/teams', team.id]">
              <h3>{{ team.name }}</h3>
              <p>
                {{ team._count?.members || 0 }} miembros ·
                {{ team._count?.retrospectives || 0 }} retros
              </p>
              <div class="team-card-badges">
                <span class="badge">{{ roleLabel(team) }}</span>
                @if ((team.pendingJoinCount ?? 0) > 0) {
                  <span class="badge request-badge">
                    {{ team.pendingJoinCount }}
                    {{ team.pendingJoinCount === 1 ? 'solicitud' : 'solicitudes' }}
                  </span>
                }
              </div>
            </a>
          } @empty {
            @if (!teamFormsOpen()) {
              <div class="empty-state card">
                <strong>Aún no tienes equipos</strong>
                Crea uno o únete con un código de invitación.
              </div>
            }
          }
        </div>
      </section>

      <div class="split">
        <section class="section">
          <h2>Retros recientes</h2>
          <div class="card list">
            @for (r of recentRetros(); track r.id) {
              <a class="list-row" [routerLink]="['/retros', r.id]">
                <div>
                  <strong>{{ r.title }}</strong>
                  <span class="muted">{{ r.teamName }}</span>
                </div>
                <span class="badge">{{ phaseLabel(r.status) }}</span>
              </a>
            } @empty {
              <div class="empty-state compact">Sin retrospectivas todavía</div>
            }
          </div>
        </section>
        <section class="section">
          <h2>Acciones pendientes</h2>
          <div class="card list">
            @for (a of pendingActions(); track a.id) {
              <div class="list-row">
                <div>
                  <strong>{{ a.title }}</strong>
                  <span class="muted">{{ a.owner?.name || 'Sin asignar' }} · {{ a.status }}</span>
                </div>
              </div>
            } @empty {
              <div class="empty-state compact">No hay acciones abiertas</div>
            }
          </div>
        </section>
      </div>
    </div>
  `,
  styles: `
    .grid-actions {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 1rem;
      margin-bottom: 1rem;
    }
    .panel {
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }
    .panel h2 {
      font-size: 1.05rem;
    }
    .section {
      margin-bottom: 1.5rem;
    }
    .section > h2,
    .section-heading h2 {
      font-size: 1.1rem;
      margin-bottom: 0.75rem;
    }
    .section-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      margin-bottom: 0.75rem;
    }
    .section-heading h2 {
      margin-bottom: 0;
    }
    .plus-icon {
      width: 1em;
      height: 1em;
      display: block;
      flex-shrink: 0;
      fill: currentColor;
    }
    .team-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 1rem;
    }
    .team-card {
      padding: 1.25rem;
      text-decoration: none;
      color: inherit;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      transition: border-color 0.15s ease;
      &:hover {
        border-color: var(--color-sky-mid);
        text-decoration: none;
      }
      p {
        color: var(--color-text-muted);
        font-size: 0.9rem;
      }
    }
    .team-card-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }
    .request-badge {
      background: var(--color-sky-soft);
      color: var(--color-brand);
      border-color: var(--color-sky-mid);
    }
    .split {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.25rem;
      align-items: stretch;
    }
    .split .section {
      display: flex;
      flex-direction: column;
      min-height: 0;
      margin-bottom: 0;
    }
    @media (max-width: 800px) {
      .split {
        grid-template-columns: 1fr;
      }
    }
    .list {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 4.75rem;
      padding: 0.25rem 0;
    }
    .list-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.75rem;
      padding: 0.85rem 1.1rem;
      text-decoration: none;
      color: inherit;
      border-bottom: 1px solid var(--color-border);
    }
    .list-row:last-child {
      border-bottom: none;
    }
    .list-row strong {
      display: block;
    }
    .muted {
      color: var(--color-text-muted);
      font-size: 0.85rem;
    }
    .empty-state.compact {
      flex: 1;
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
  private readonly joinRequests = inject(JoinRequestService);
  private readonly router = inject(Router);

  teams = signal<TeamSummary[]>([]);
  recentRetros = signal<
    {
      id: string;
      title: string;
      status: string;
      teamName: string;
      createdAt: string;
    }[]
  >([]);
  pendingActions = signal<ActionItem[]>([]);
  teamFormsOpen = signal(false);
  newTeamName = '';
  joinCode = '';
  error = signal('');

  constructor() {
    effect(() => {
      const version = this.joinRequests.changed();
      if (version === 0) return;
      untracked(() => this.reload());
    });
  }

  ngOnInit() {
    this.reload();
  }

  toggleTeamForms() {
    this.teamFormsOpen.update((open) => !open);
  }

  roleLabel(team: TeamSummary): string {
    const role = team.role || team.members?.[0]?.role;
    return role === 'facilitator' ? 'Facilitador' : 'Miembro';
  }

  phaseLabel(status: string): string {
    return PHASE_LABELS[status as keyof typeof PHASE_LABELS] || status;
  }

  reload() {
    this.api.listTeams().subscribe({
      next: (teams) => {
        this.teams.set(teams);
        if (!teams.length) {
          this.teamFormsOpen.set(true);
          this.recentRetros.set([]);
          this.pendingActions.set([]);
          return;
        }
        forkJoin(
          teams.map((t) => this.api.getTeam(t.id).pipe(catchError(() => of(null)))),
        ).subscribe((details) => {
          const retros: {
            id: string;
            title: string;
            status: string;
            teamName: string;
            createdAt: string;
          }[] = [];
          for (const d of details) {
            if (!d) continue;
            for (const r of d.retrospectives || []) {
              retros.push({
                id: r.id,
                title: r.title,
                status: r.status,
                teamName: d.name,
                createdAt: r.createdAt,
              });
            }
          }
          retros.sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );
          this.recentRetros.set(retros.slice(0, 3));
        });
        forkJoin(
          teams.map((t) =>
            this.api.listActions(t.id).pipe(catchError(() => of([] as ActionItem[]))),
          ),
        ).subscribe((lists) => {
          this.pendingActions.set(
            lists
              .flat()
              .filter((a) => a.status === 'pending' || a.status === 'doing')
              .slice(0, 10),
          );
        });
      },
      error: () => this.error.set('No se pudieron cargar los equipos'),
    });
  }

  createTeam() {
    this.api.createTeam(this.newTeamName).subscribe({
      next: (team) => {
        this.newTeamName = '';
        this.auth.markFacilitator();
        const id = (team as { id?: string }).id;
        if (id) void this.router.navigate(['/teams', id]);
        else this.reload();
      },
      error: (e) => this.error.set(e?.error?.message || 'Error al crear'),
    });
  }

  joinTeam() {
    this.api.joinTeam(this.joinCode).subscribe({
      next: (team) => {
        this.joinCode = '';
        const id = (team as { id?: string }).id;
        if (id) void this.router.navigate(['/teams', id]);
        else this.reload();
      },
      error: (e) => this.error.set(e?.error?.message || 'Código inválido'),
    });
  }
}
