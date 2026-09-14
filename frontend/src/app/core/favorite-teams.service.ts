import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { TeamSummary } from './models';

export interface FavoriteTeam {
  id: string;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class FavoriteTeamsService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  readonly favorites = signal<FavoriteTeam[]>([]);

  constructor() {
    effect(() => {
      const isUser = this.auth.isUser();
      this.auth.token();
      untracked(() => {
        if (isUser) this.load();
        else this.favorites.set([]);
      });
    });
  }

  load() {
    this.api.listTeams().subscribe({
      next: (teams) => this.favorites.set(fromSummaries(teams)),
      error: () => this.favorites.set([]),
    });
  }

  setFavorite(teamId: string, favorited: boolean, name?: string) {
    return this.api.setTeamFavorite(teamId, favorited).pipe(
      tap((res) => {
        this.favorites.update((current) => {
          const without = current.filter((t) => t.id !== teamId);
          if (!res.favorited) return without;
          return [...without, { id: res.id, name: res.name || name || '' }];
        });
      }),
    );
  }
}

function fromSummaries(teams: TeamSummary[]): FavoriteTeam[] {
  return teams
    .filter((t) => t.favorited)
    .sort((a, b) => {
      const aAt = a.favoritedAt ? new Date(a.favoritedAt).getTime() : 0;
      const bAt = b.favoritedAt ? new Date(b.favoritedAt).getTime() : 0;
      return aAt - bAt;
    })
    .slice(0, 3)
    .map((t) => ({ id: t.id, name: t.name }));
}
