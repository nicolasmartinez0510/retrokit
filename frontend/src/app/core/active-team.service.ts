import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { TeamSummary } from './models';
import { SocketService } from './socket.service';
import { ToastService } from './toast.service';

const STORAGE_KEY = 'retrokit_active_team';

@Injectable({ providedIn: 'root' })
export class ActiveTeamService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly sockets = inject(SocketService);
  private readonly toast = inject(ToastService);

  readonly teams = signal<TeamSummary[]>([]);
  /** False until the first listTeams() for the current session completes. */
  readonly ready = signal(false);
  /** Team id from `/teams/:id` routes, else last visited / first in list. */
  readonly activeTeamId = signal<string | null>(this.readStored());

  readonly activeTeam = computed(() => {
    const id = this.activeTeamId();
    if (!id) return null;
    return this.teams().find((t) => t.id === id) ?? null;
  });

  readonly hasTeams = computed(() => this.teams().length > 0);

  private bound = false;

  private readonly onMemberRemoved = (payload: unknown) => {
    const teamId = readString(payload, 'teamId');
    const teamName = readString(payload, 'teamName') || 'un equipo';
    if (!teamId) return;
    this.handleRemovedFromTeam(teamId, teamName);
  };

  constructor() {
    effect(() => {
      const isUser = this.auth.isUser();
      this.auth.token();
      untracked(() => {
        if (isUser) {
          this.load();
          this.attachSocket();
        } else {
          this.detachSocket();
          this.teams.set([]);
          this.clearActive();
          this.ready.set(false);
        }
      });
    });

    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.syncFromUrl(e.urlAfterRedirects));

    this.syncFromUrl(this.router.url);

    effect(() => {
      const ready = this.ready();
      const hasTeams = this.hasTeams();
      const url = this.router.url;
      untracked(() => {
        if (!ready || !this.auth.isUser()) return;
        if (!hasTeams && isTeamScopedRoute(url)) {
          void this.router.navigate(['/dashboard']);
        }
      });
    });
  }

  load(onDone?: (teams: TeamSummary[]) => void) {
    this.api.listTeams().subscribe({
      next: (teams) => {
        this.teams.set(teams);
        this.ensureActive(teams);
        this.ready.set(true);
        onDone?.(teams);
      },
      error: () => {
        this.teams.set([]);
        this.clearActive();
        this.ready.set(true);
        onDone?.([]);
      },
    });
  }

  /** After joining/creating: select team and go to panel. */
  enterTeam(teamId: string, teamName?: string) {
    this.load((teams) => {
      if (teams.some((t) => t.id === teamId)) {
        this.setActive(teamId);
      } else if (teams[0]) {
        this.setActive(teams[0].id);
      }
      if (teamName) {
        this.toast.ok(`Te sumaste a ${teamName}`);
      }
      void this.router.navigate(['/dashboard']);
    });
  }

  setActive(teamId: string) {
    this.activeTeamId.set(teamId);
    try {
      localStorage.setItem(STORAGE_KEY, teamId);
    } catch {
      /* ignore */
    }
  }

  clearActive() {
    this.activeTeamId.set(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  selectTeam(teamId: string) {
    this.setActive(teamId);
    void this.router.navigate(['/teams', teamId]);
  }

  /** Drop a stale active id (e.g. getTeam 404) and refresh memberships. */
  invalidateActive() {
    this.clearActive();
    this.load();
  }

  private handleRemovedFromTeam(teamId: string, teamName: string) {
    const wasActive = this.activeTeamId() === teamId;
    this.api.listTeams().subscribe({
      next: (teams) => {
        this.teams.set(teams);
        this.ready.set(true);

        if (!teams.length) {
          this.clearActive();
          this.toast.error(`Te eliminaron de ${teamName}`);
          void this.router.navigate(['/dashboard']);
          return;
        }

        this.toast.error(`Te eliminaron de ${teamName}`);

        if (wasActive || !teams.some((t) => t.id === this.activeTeamId())) {
          this.setActive(teams[0].id);
          void this.router.navigate(['/dashboard']);
        }
      },
      error: () => {
        this.clearActive();
        this.teams.set([]);
        this.ready.set(true);
        this.toast.error(`Te eliminaron de ${teamName}`);
        void this.router.navigate(['/dashboard']);
      },
    });
  }

  private attachSocket() {
    if (this.bound) return;
    this.sockets.connect();
    this.sockets.on('team-member-removed', this.onMemberRemoved);
    this.bound = true;
  }

  private detachSocket() {
    if (!this.bound) return;
    this.sockets.off('team-member-removed', this.onMemberRemoved);
    this.bound = false;
  }

  private syncFromUrl(url: string) {
    const match = url.match(/\/teams\/([^/?#]+)/);
    if (!match?.[1]) return;
    const teamId = match[1];
    if (teamId === 'invites') return;
    const teams = this.teams();
    if (this.ready() && teams.length && !teams.some((t) => t.id === teamId)) {
      return;
    }
    this.setActive(teamId);
  }

  private ensureActive(teams: TeamSummary[]) {
    if (!teams.length) {
      this.clearActive();
      return;
    }
    const current = this.activeTeamId();
    if (current && teams.some((t) => t.id === current)) return;
    this.setActive(teams[0].id);
  }

  private readStored(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }
}

function isTeamScopedRoute(url: string): boolean {
  const path = url.split('?')[0].split('#')[0];
  if (path === '/teams') return false;
  return /^\/teams\/[^/]+/.test(path);
}

function readString(payload: unknown, key: string): string {
  if (!payload || typeof payload !== 'object') return '';
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : '';
}
