import { TeamSummary } from './models';

/** Destacados arriba (el más reciente primero), después por equipo más nuevo. */
export function sortTeams(teams: TeamSummary[]): TeamSummary[] {
  return teams.slice().sort((a, b) => {
    if (!!a.favorited !== !!b.favorited) return a.favorited ? -1 : 1;
    if (a.favorited && b.favorited) {
      return time(b.favoritedAt) - time(a.favoritedAt);
    }
    return time(b.createdAt) - time(a.createdAt);
  });
}

/** Aplica el destacado en la lista local y reordena, sin esperar al backend. */
export function withFavorite(
  teams: TeamSummary[],
  teamId: string,
  favorited: boolean,
  favoritedAt?: string | null,
): TeamSummary[] {
  return sortTeams(
    teams.map((team) =>
      team.id === teamId
        ? {
            ...team,
            favorited,
            favoritedAt: favorited
              ? favoritedAt ?? new Date().toISOString()
              : null,
          }
        : team,
    ),
  );
}

function time(iso?: string | null) {
  return iso ? new Date(iso).getTime() : 0;
}
