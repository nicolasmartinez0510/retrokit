import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ActiveTeamService } from '../../core/active-team.service';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { httpErrorMessage } from '../../core/http-error';
import {
  OutgoingTeamInvite,
  TeamDetail,
  TeamJoinRequest,
  TeamMember,
  UserSearchHit,
} from '../../core/models';
import { SocketService } from '../../core/socket.service';
import { ToastService } from '../../core/toast.service';
import { UserAvatarComponent } from '../../shared/user-avatar.component';

@Component({
  selector: 'app-members-page',
  imports: [FormsModule, UserAvatarComponent],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Miembros</h1>
          <p class="subtitle">
            @if (team(); as t) {
              {{ t.name }}
            } @else {
              Personas del equipo activo
            }
          </p>
        </div>
        @if (isFacilitator()) {
          <button type="button" class="btn-primary" (click)="openInvite()">
            Invitar
          </button>
        }
      </div>

      @if (error()) {
        <p class="form-error">{{ error() }}</p>
      }

      @if (joinRequests().length) {
        <section class="section">
          <h2>Solicitudes de ingreso</h2>
          <div class="list">
            @for (req of joinRequests(); track req.id) {
              <div class="card row">
                <div class="person">
                  <app-user-avatar
                    [avatarId]="req.user.avatarId"
                    [seed]="req.user.id"
                    [name]="req.user.name"
                    size="chip"
                  />
                  <div>
                    <strong>{{ req.user.name }}</strong>
                    <p class="meta">{{ req.user.email }}</p>
                  </div>
                </div>
                <div class="row-actions">
                  <button
                    type="button"
                    class="btn-primary btn-sm"
                    (click)="acceptJoin(req)"
                  >
                    Aceptar
                  </button>
                  <button
                    type="button"
                    class="btn-danger btn-sm"
                    (click)="rejectJoin(req)"
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            }
          </div>
        </section>
      }

      @if (isFacilitator() && pendingInvites().length) {
        <section class="section">
          <h2>Invitaciones pendientes</h2>
          <div class="list">
            @for (invite of pendingInvites(); track invite.id) {
              <div class="card row">
                <div class="person">
                  <app-user-avatar
                    [avatarId]="invite.invitee.avatarId"
                    [seed]="invite.invitee.id"
                    [name]="invite.invitee.name"
                    size="chip"
                  />
                  <div>
                    <strong>{{ invite.invitee.name }}</strong>
                    <p class="meta">{{ invite.invitee.email }}</p>
                  </div>
                </div>
                <button
                  type="button"
                  class="btn-danger btn-sm"
                  (click)="cancelInvite(invite)"
                >
                  Cancelar
                </button>
              </div>
            }
          </div>
        </section>
      }

      <section class="section">
        <h2>Equipo</h2>
        <div class="list">
          @for (m of members(); track m.id) {
            <div class="card row">
              <div class="person">
                <app-user-avatar
                  [avatarId]="m.user.avatarId"
                  [seed]="m.user.id"
                  [name]="m.user.name"
                  size="chip"
                />
                <div>
                  <strong>{{ m.user.name }}</strong>
                  <p class="meta">
                    {{ roleLabel(m.role) }}
                    · {{ m.user.email }}
                  </p>
                </div>
              </div>
              @if (canRemove(m)) {
                <button
                  type="button"
                  class="icon-btn"
                  title="Quitar del equipo"
                  aria-label="Quitar del equipo"
                  (click)="removeMember(m)"
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
            <div class="empty-state">No hay miembros</div>
          }
        </div>
      </section>
    </div>

    @if (inviteOpen()) {
      <div class="backdrop" (click)="inviteOpen.set(false)">
        <div class="card modal" (click)="$event.stopPropagation()">
          <h2>Invitar a {{ team()?.name }}</h2>

          <div class="invite-block">
            <h3>Enlace</h3>
            <div class="copy-row">
              <code class="code">{{ inviteLink() }}</code>
              <button
                type="button"
                class="btn-secondary btn-sm"
                (click)="copyText(inviteLink(), 'Enlace copiado')"
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
                  (keydown.enter)="$event.preventDefault(); submitInvite()"
                  placeholder="persona@empresa.com"
                />
                <button
                  type="button"
                  class="btn-primary btn-sm"
                  [disabled]="inviting() || !inviteEmail.trim()"
                  (click)="submitInvite()"
                >
                  {{ inviting() ? '…' : 'Invitar' }}
                </button>
              </div>
            </label>
            @if (inviteHits().length) {
              <ul class="hits">
                @for (hit of inviteHits(); track hit.id) {
                  <li>
                    <button type="button" class="hit" (click)="sendInvite(hit)">
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
              <code class="code">{{ team()?.inviteCode }}</code>
              <button
                type="button"
                class="btn-secondary btn-sm"
                (click)="copyText(team()?.inviteCode || '', 'Código copiado')"
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
              (click)="inviteOpen.set(false)"
            >
              Cerrar
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
    .person {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-width: 0;
      flex: 1;
    }
    .meta {
      margin: 0.15rem 0 0;
      color: var(--color-text-muted);
      font-size: 0.85rem;
    }
    .row-actions {
      display: flex;
      gap: 0.4rem;
      align-items: center;
    }
    .icon-btn {
      appearance: none;
      width: 1.85rem;
      height: 1.85rem;
      padding: 0;
      border-radius: 8px;
      display: grid;
      place-items: center;
      background: transparent;
      border: none;
      cursor: pointer;
      color: var(--color-danger);
    }
    .icon-btn:hover {
      background: var(--color-danger-soft);
    }
    .icon-btn svg {
      width: 1.1rem;
      height: 1.1rem;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.75;
      stroke-linecap: round;
      stroke-linejoin: round;
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
      width: min(440px, 100%);
      padding: 1.35rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .modal h2 {
      margin: 0;
      font-size: 1.15rem;
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
    .hits {
      list-style: none;
      margin: 0.45rem 0 0;
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
    }
  `,
})
export class MembersPage implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly activeTeams = inject(ActiveTeamService);
  private readonly sockets = inject(SocketService);
  private readonly toast = inject(ToastService);

  team = signal<TeamDetail | null>(null);
  pendingInvites = signal<OutgoingTeamInvite[]>([]);
  error = signal('');
  modalError = signal('');
  inviteOpen = signal(false);
  inviting = signal(false);
  inviteHits = signal<UserSearchHit[]>([]);
  inviteEmail = '';
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  members = () => this.team()?.members ?? [];
  joinRequests = () => this.team()?.joinRequests ?? [];

  private readonly onInviteResolved = (payload: unknown) => {
    const teamId = readPayloadString(payload, 'teamId');
    if (!teamId || teamId !== this.team()?.id) return;
    this.reload();
  };

  private readonly onJoinRequestResolved = (payload: unknown) => {
    const teamId = readPayloadString(payload, 'teamId');
    if (!teamId || teamId !== this.team()?.id) return;
    this.reload();
  };

  ngOnInit() {
    this.sockets.connect();
    this.sockets.on('team-invite-resolved', this.onInviteResolved);
    this.sockets.on('team-join-request-resolved', this.onJoinRequestResolved);
    this.route.paramMap.subscribe(() => this.reload());
  }

  ngOnDestroy() {
    this.sockets.off('team-invite-resolved', this.onInviteResolved);
    this.sockets.off('team-join-request-resolved', this.onJoinRequestResolved);
  }

  roleLabel(role: string) {
    return role === 'facilitator' ? 'Facilitador' : 'Miembro';
  }

  isFacilitator() {
    const userId = this.auth.user()?.id;
    if (!userId) return false;
    return this.members().some(
      (m) => m.user.id === userId && m.role === 'facilitator',
    );
  }

  canRemove(m: TeamMember) {
    if (!this.isFacilitator()) return false;
    if (m.user.id === this.auth.user()?.id) return false;
    return true;
  }

  inviteLink() {
    const code = this.team()?.inviteCode;
    if (!code || typeof window === 'undefined') return '';
    return `${window.location.origin}/join-team/${code}`;
  }

  reload() {
    const id =
      this.route.snapshot.paramMap.get('id') ||
      this.activeTeams.activeTeamId();
    if (!id) {
      this.error.set('Elegí un equipo en la barra lateral');
      this.team.set(null);
      this.pendingInvites.set([]);
      return;
    }
    this.api.getTeam(id).subscribe({
      next: (t) => {
        this.team.set(t);
        this.activeTeams.setActive(t.id);
        this.error.set('');
        this.reloadOutgoing(t.id);
      },
      error: () => this.error.set('No se pudo cargar el equipo'),
    });
  }

  reloadOutgoing(teamId: string) {
    const userId = this.auth.user()?.id;
    const isFac =
      !!userId &&
      (this.team()?.members.some(
        (m) => m.user.id === userId && m.role === 'facilitator',
      ) ??
        false);
    if (!isFac) {
      this.pendingInvites.set([]);
      return;
    }
    this.api.listOutgoingTeamInvites(teamId).subscribe({
      next: (list) => this.pendingInvites.set(list),
      error: () => this.pendingInvites.set([]),
    });
  }

  openInvite() {
    this.modalError.set('');
    this.inviteEmail = '';
    this.inviteHits.set([]);
    this.inviteOpen.set(true);
  }

  copyText(text: string, okMsg: string) {
    if (!text) return;
    void navigator.clipboard.writeText(text).then(
      () => this.toast.ok(okMsg),
      () => this.toast.error('No se pudo copiar'),
    );
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

  sendInvite(hit: UserSearchHit) {
    const team = this.team();
    if (!team || this.inviting()) return;
    this.modalError.set('');
    this.inviting.set(true);
    this.api.inviteTeamMember(team.id, hit.email).subscribe({
      next: () => {
        this.inviting.set(false);
        this.toast.ok(`Invitación enviada a ${hit.name}`);
        this.inviteHits.set([]);
        this.inviteEmail = '';
        this.reloadOutgoing(team.id);
      },
      error: (e) => {
        this.inviting.set(false);
        this.modalError.set(httpErrorMessage(e, 'No se pudo invitar'));
      },
    });
  }

  submitInvite() {
    const team = this.team();
    const q = this.inviteEmail.trim().toLowerCase();
    if (!team || !q || this.inviting()) return;
    const hits = this.inviteHits();
    const exact = hits.find((h) => h.email.toLowerCase() === q);
    if (exact) {
      this.sendInvite(exact);
      return;
    }
    if (hits.length === 1) {
      this.sendInvite(hits[0]);
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
        this.sendInvite(match);
      },
      error: () => {
        this.inviting.set(false);
        this.modalError.set('No se pudo buscar el usuario');
      },
    });
  }

  cancelInvite(invite: OutgoingTeamInvite) {
    const team = this.team();
    if (!team) return;
    this.api.cancelTeamInvite(team.id, invite.id).subscribe({
      next: () => {
        this.toast.ok(`Invitación a ${invite.invitee.name} cancelada`);
        this.reloadOutgoing(team.id);
      },
      error: (e) =>
        this.toast.error(httpErrorMessage(e, 'No se pudo cancelar')),
    });
  }

  acceptJoin(req: TeamJoinRequest) {
    const team = this.team();
    if (!team) return;
    this.api.acceptJoinRequest(team.id, req.id).subscribe({
      next: () => {
        this.toast.ok(`${req.user.name} se sumó al equipo`);
        this.reload();
      },
      error: (e) =>
        this.toast.error(httpErrorMessage(e, 'No se pudo aceptar')),
    });
  }

  rejectJoin(req: TeamJoinRequest) {
    const team = this.team();
    if (!team) return;
    this.api.rejectJoinRequest(team.id, req.id).subscribe({
      next: () => this.reload(),
      error: (e) =>
        this.toast.error(httpErrorMessage(e, 'No se pudo rechazar')),
    });
  }

  removeMember(m: TeamMember) {
    const team = this.team();
    if (!team) return;
    if (!confirm(`¿Quitar a ${m.user.name} del equipo?`)) return;
    this.api.removeTeamMember(team.id, m.user.id).subscribe({
      next: () => {
        this.toast.ok('Miembro quitado');
        this.team.set({
          ...team,
          members: team.members.filter((x) => x.id !== m.id),
        });
      },
      error: (e) =>
        this.toast.error(httpErrorMessage(e, 'No se pudo quitar')),
    });
  }
}

function readPayloadString(payload: unknown, key: string): string {
  if (!payload || typeof payload !== 'object') return '';
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : '';
}
