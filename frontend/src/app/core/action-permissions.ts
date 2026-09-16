import { ActionItem, TeamDetail, User } from './models';

export function isTeamFacilitator(
  user: User | null | undefined,
  team: TeamDetail | null,
) {
  if (user?.isAdmin) return true;
  if (!user?.id) return false;
  return (
    team?.members.some(
      (member) => member.user.id === user.id && member.role === 'facilitator',
    ) ?? false
  );
}

/**
 * Facilitator y admin pueden con todas las acciones del equipo; el resto solo
 * con las que crearon o les asignaron. Los avances heredan este permiso.
 */
export function canMutateAction(
  item: ActionItem,
  user: User | null | undefined,
  team: TeamDetail | null,
) {
  if (isTeamFacilitator(user, team)) return true;
  if (!user?.id) return false;
  return item.createdById === user.id || item.ownerId === user.id;
}
