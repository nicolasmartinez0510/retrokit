import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TeamInviteStatus, TeamRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeEventsService } from '../realtime/realtime-events.service';
import {
  resolveParticipantAvatar,
  userPublicSelect,
} from '../common/avatars';
import { UploadsService } from '../uploads/uploads.service';
import {
  CreateTeamDto,
  InviteTeamMemberDto,
  JoinTeamDto,
  UpdateTeamDto,
} from './dto/teams.dto';

const joinRequestUserSelect = userPublicSelect;
const MAX_FAVORITE_TEAMS = 3;

const retroSummarySelect = {
  id: true,
  title: true,
  createdAt: true,
  closedAt: true,
  currentPhase: { select: { id: true, name: true, kind: true } },
  template: { select: { name: true } },
  _count: { select: { cards: true } },
  participants: {
    orderBy: { id: 'asc' as const },
    select: {
      id: true,
      guestName: true,
      isGuest: true,
      avatarId: true,
      user: { select: { id: true, name: true, avatarId: true } },
    },
  },
} as const;

@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: RealtimeEventsService,
    private readonly uploads: UploadsService,
  ) {}

  async create(userId: string, dto: CreateTeamDto) {
    const team = await this.prisma.team.create({
      data: {
        name: dto.name.trim(),
        members: {
          create: { userId, role: TeamRole.facilitator },
        },
      },
      include: {
        members: {
          include: { user: { select: userPublicSelect } },
        },
        retrospectives: {
          orderBy: { createdAt: 'desc' },
          select: retroSummarySelect,
        },
      },
    });

    const emails = (dto.inviteEmails ?? [])
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    for (const email of emails) {
      try {
        await this.inviteByEmail(userId, team.id, { email });
      } catch {
        /* skip invalid/duplicate invites on create */
      }
    }

    return this.withMappedRetros(team);
  }

  async listForUser(userId: string) {
    const admin = await this.isAdmin(userId);
    const teams = await this.prisma.team.findMany({
      where: admin ? undefined : { members: { some: { userId } } },
      include: {
        _count: {
          select: { members: true, retrospectives: true, joinRequests: true },
        },
        members: {
          where: { userId },
          select: { role: true, favoritedAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return teams
      .map((t) => {
        const membership = t.members[0];
        const role = membership?.role;
        const favoritedAt = membership?.favoritedAt ?? null;
        const { _count, members, ...rest } = t;
        const canManage = admin || role === TeamRole.facilitator;
        return {
          ...rest,
          role,
          favorited: !!favoritedAt,
          favoritedAt,
          members: members.map(({ role: memberRole }) => ({
            role: memberRole,
          })),
          _count: {
            members: _count.members,
            retrospectives: _count.retrospectives,
          },
          pendingJoinCount: canManage ? _count.joinRequests : 0,
        };
      })
      .sort((a, b) => {
        if (a.favorited !== b.favorited) return a.favorited ? -1 : 1;
        if (a.favorited && b.favorited) {
          const aAt = a.favoritedAt
            ? new Date(a.favoritedAt).getTime()
            : 0;
          const bAt = b.favoritedAt
            ? new Date(b.favoritedAt).getTime()
            : 0;
          return bAt - aAt;
        }
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
  }

  async getOne(userId: string, teamId: string) {
    const admin = await this.isAdmin(userId);
    const membership = admin
      ? await this.prisma.teamMember.findUnique({
          where: { teamId_userId: { teamId, userId } },
        })
      : await this.assertMember(userId, teamId);
    if (!admin && !membership) {
      throw new ForbiddenException('Not a team member');
    }
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          include: { user: { select: userPublicSelect } },
          orderBy: { id: 'asc' },
        },
        retrospectives: {
          orderBy: { createdAt: 'desc' },
          select: retroSummarySelect,
        },
      },
    });
    if (!team) throw new NotFoundException('Team not found');
    const favorited = !!membership?.favoritedAt;
    const members = team.members.map(({ favoritedAt: _favoritedAt, ...member }) => member);
    const mapped = this.withMappedRetros({ ...team, members });
    const canManage =
      admin || membership?.role === TeamRole.facilitator;
    if (!canManage) {
      return { ...mapped, favorited, joinRequests: [] };
    }
    const joinRequests = await this.prisma.teamJoinRequest.findMany({
      where: { teamId },
      include: { user: { select: joinRequestUserSelect } },
      orderBy: { createdAt: 'asc' },
    });
    return { ...mapped, favorited, joinRequests };
  }

  async setFavorite(userId: string, teamId: string, favorited: boolean) {
    const membership = await this.assertMember(userId, teamId);
    if (favorited) {
      if (!membership.favoritedAt) {
        const count = await this.prisma.teamMember.count({
          where: { userId, favoritedAt: { not: null } },
        });
        if (count >= MAX_FAVORITE_TEAMS) {
          throw new BadRequestException('Podés destacar hasta 3 equipos');
        }
        await this.prisma.teamMember.update({
          where: { teamId_userId: { teamId, userId } },
          data: { favoritedAt: new Date() },
        });
      }
    } else if (membership.favoritedAt) {
      await this.prisma.teamMember.update({
        where: { teamId_userId: { teamId, userId } },
        data: { favoritedAt: null },
      });
    }

    const [team, updated] = await Promise.all([
      this.prisma.team.findUnique({
        where: { id: teamId },
        select: { id: true, name: true },
      }),
      this.prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId } },
        select: { favoritedAt: true },
      }),
    ]);
    if (!team) throw new NotFoundException('Team not found');
    return {
      id: team.id,
      name: team.name,
      favorited: !!updated?.favoritedAt,
      favoritedAt: updated?.favoritedAt ?? null,
    };
  }

  async update(userId: string, teamId: string, dto: UpdateTeamDto) {
    await this.assertFacilitatorOrAdmin(userId, teamId);
    await this.prisma.team.update({
      where: { id: teamId },
      data: { ...(dto.name !== undefined ? { name: dto.name.trim() } : {}) },
    });
    return this.getOne(userId, teamId);
  }

  async uploadLogo(
    userId: string,
    teamId: string,
    file: Express.Multer.File,
  ) {
    await this.assertFacilitatorOrAdmin(userId, teamId);
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { logoUrl: true },
    });
    if (!team) throw new NotFoundException('Team not found');
    const url = await this.uploads.saveTeamLogo(teamId, file);
    await this.prisma.team.update({
      where: { id: teamId },
      data: { logoUrl: url },
    });
    if (team.logoUrl && team.logoUrl !== url) {
      await this.uploads.deleteByPublicUrl(team.logoUrl);
    }
    return this.getOne(userId, teamId);
  }

  async deleteLogo(userId: string, teamId: string) {
    await this.assertFacilitatorOrAdmin(userId, teamId);
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { logoUrl: true },
    });
    if (!team) throw new NotFoundException('Team not found');
    await this.prisma.team.update({
      where: { id: teamId },
      data: { logoUrl: null },
    });
    await this.uploads.deleteByPublicUrl(team.logoUrl);
    await this.uploads.deleteTeamLogoDir(teamId);
    return this.getOne(userId, teamId);
  }

  async remove(userId: string, teamId: string) {
    await this.assertFacilitatorOrAdmin(userId, teamId);
    await this.prisma.team.delete({ where: { id: teamId } });
    await this.uploads.deleteTeamLogoDir(teamId);
    return { deleted: true };
  }

  async inviteByEmail(
    actorId: string,
    teamId: string,
    dto: InviteTeamMemberDto,
  ) {
    await this.assertFacilitatorOrAdmin(actorId, teamId);
    const email = dto.email.trim().toLowerCase();
    const invitee = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { ...userPublicSelect, isAdmin: true },
    });
    if (!invitee) {
      throw new NotFoundException('No hay un usuario registrado con ese email');
    }
    if (invitee.isAdmin) {
      throw new BadRequestException(
        'El administrador de la app no puede ser invitado a un equipo',
      );
    }
    if (invitee.id === actorId) {
      throw new BadRequestException('No podés invitarte a vos mismo');
    }

    const membership = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: invitee.id } },
    });
    if (membership) {
      throw new BadRequestException('Esa persona ya es miembro del equipo');
    }

    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, name: true, logoUrl: true },
    });
    if (!team) throw new NotFoundException('Team not found');

    const inviter = await this.prisma.user.findUnique({
      where: { id: actorId },
      select: userPublicSelect,
    });

    const existing = await this.prisma.teamInvite.findUnique({
      where: { teamId_inviteeId: { teamId, inviteeId: invitee.id } },
    });

    let invite;
    if (existing) {
      if (existing.status === TeamInviteStatus.pending) {
        throw new BadRequestException('Ya hay una invitación pendiente');
      }
      invite = await this.prisma.teamInvite.update({
        where: { id: existing.id },
        data: {
          status: TeamInviteStatus.pending,
          inviterId: actorId,
        },
      });
    } else {
      invite = await this.prisma.teamInvite.create({
        data: {
          teamId,
          inviterId: actorId,
          inviteeId: invitee.id,
          status: TeamInviteStatus.pending,
        },
      });
    }

    const payload = {
      id: invite.id,
      teamId: team.id,
      teamName: team.name,
      teamLogoUrl: team.logoUrl,
      createdAt: invite.createdAt,
      inviter: inviter!,
    };
    this.events.emitToUser(invitee.id, 'team-invite', payload);
    return payload;
  }

  async listOutgoingInvites(actorId: string, teamId: string) {
    await this.assertFacilitatorOrAdmin(actorId, teamId);
    const invites = await this.prisma.teamInvite.findMany({
      where: { teamId, status: TeamInviteStatus.pending },
      include: {
        invitee: { select: userPublicSelect },
        inviter: { select: userPublicSelect },
      },
      orderBy: { createdAt: 'desc' },
    });
    return invites.map((invite) => ({
      id: invite.id,
      teamId: invite.teamId,
      createdAt: invite.createdAt,
      invitee: invite.invitee,
      inviter: invite.inviter,
    }));
  }

  async cancelInvite(actorId: string, teamId: string, inviteId: string) {
    await this.assertFacilitatorOrAdmin(actorId, teamId);
    const invite = await this.prisma.teamInvite.findUnique({
      where: { id: inviteId },
      include: { team: { select: { name: true } } },
    });
    if (!invite || invite.teamId !== teamId) {
      throw new NotFoundException('Invitation not found');
    }
    if (invite.status !== TeamInviteStatus.pending) {
      throw new BadRequestException('Invitation is not pending');
    }
    await this.prisma.teamInvite.update({
      where: { id: invite.id },
      data: { status: TeamInviteStatus.rejected },
    });
    this.events.emitToUser(invite.inviteeId, 'team-invite-resolved', {
      id: invite.id,
      teamId: invite.teamId,
      accepted: false,
      inviteeId: invite.inviteeId,
    });
    return { cancelled: true, teamId: invite.teamId, teamName: invite.team.name };
  }

  async listIncomingInvites(userId: string) {
    const invites = await this.prisma.teamInvite.findMany({
      where: { inviteeId: userId, status: TeamInviteStatus.pending },
      include: {
        team: { select: { id: true, name: true, logoUrl: true } },
        inviter: { select: userPublicSelect },
      },
      orderBy: { createdAt: 'desc' },
    });
    return invites.map((invite) => ({
      id: invite.id,
      teamId: invite.team.id,
      teamName: invite.team.name,
      teamLogoUrl: invite.team.logoUrl,
      createdAt: invite.createdAt,
      inviter: invite.inviter,
    }));
  }

  async acceptInvite(userId: string, inviteId: string) {
    const invite = await this.prisma.teamInvite.findUnique({
      where: { id: inviteId },
      include: { team: { select: { id: true, name: true } } },
    });
    if (!invite || invite.inviteeId !== userId) {
      throw new NotFoundException('Invitación no encontrada');
    }
    if (invite.status !== TeamInviteStatus.pending) {
      throw new BadRequestException('La invitación ya fue resuelta');
    }

    await this.prisma.$transaction([
      this.prisma.teamMember.upsert({
        where: {
          teamId_userId: { teamId: invite.teamId, userId },
        },
        create: {
          teamId: invite.teamId,
          userId,
          role: TeamRole.member,
        },
        update: {},
      }),
      this.prisma.teamInvite.update({
        where: { id: invite.id },
        data: { status: TeamInviteStatus.accepted },
      }),
      this.prisma.teamJoinRequest.deleteMany({
        where: { teamId: invite.teamId, userId },
      }),
    ]);

    await this.emitTeamInviteResolved(invite.teamId, {
      id: invite.id,
      teamId: invite.teamId,
      teamName: invite.team.name,
      accepted: true,
      inviteeId: userId,
    });
    return { accepted: true, teamId: invite.teamId, teamName: invite.team.name };
  }

  async rejectInvite(userId: string, inviteId: string) {
    const invite = await this.prisma.teamInvite.findUnique({
      where: { id: inviteId },
      include: { team: { select: { id: true, name: true } } },
    });
    if (!invite || invite.inviteeId !== userId) {
      throw new NotFoundException('Invitación no encontrada');
    }
    if (invite.status !== TeamInviteStatus.pending) {
      throw new BadRequestException('La invitación ya fue resuelta');
    }

    await this.prisma.teamInvite.update({
      where: { id: invite.id },
      data: { status: TeamInviteStatus.rejected },
    });

    await this.emitTeamInviteResolved(invite.teamId, {
      id: invite.id,
      teamId: invite.teamId,
      teamName: invite.team.name,
      accepted: false,
      inviteeId: userId,
    });
    return { rejected: true, teamId: invite.teamId, teamName: invite.team.name };
  }

  async searchUsersByEmail(actorId: string, email: string) {
    const q = email.trim().toLowerCase();
    if (q.length < 3) return [];
    const users = await this.prisma.user.findMany({
      where: {
        email: { contains: q, mode: 'insensitive' },
        isAdmin: false,
        NOT: { id: actorId },
      },
      select: userPublicSelect,
      take: 8,
      orderBy: { email: 'asc' },
    });
    return users;
  }

  async listMembers(userId: string, teamId: string) {
    await this.assertMemberOrAdmin(userId, teamId);
    return this.prisma.teamMember.findMany({
      where: { teamId },
      include: {
        user: { select: userPublicSelect },
      },
    });
  }

  async removeMember(actorId: string, teamId: string, targetUserId: string) {
    await this.assertFacilitatorOrAdmin(actorId, teamId);
    if (actorId === targetUserId) {
      throw new BadRequestException(
        'No podés sacarte a vos mismo del equipo',
      );
    }

    const target = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: targetUserId } },
    });
    if (!target) throw new NotFoundException('Miembro no encontrado');

    if (target.role === TeamRole.facilitator) {
      const facilitatorCount = await this.prisma.teamMember.count({
        where: { teamId, role: TeamRole.facilitator },
      });
      if (facilitatorCount <= 1) {
        throw new BadRequestException(
          'No se puede sacar al único facilitador del equipo',
        );
      }
    }

    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, name: true },
    });
    if (!team) throw new NotFoundException('Team not found');

    await this.prisma.teamMember.delete({
      where: { teamId_userId: { teamId, userId: targetUserId } },
    });

    await this.prisma.teamInvite.updateMany({
      where: {
        teamId,
        inviteeId: targetUserId,
        status: TeamInviteStatus.pending,
      },
      data: { status: TeamInviteStatus.rejected },
    });

    this.events.emitToUser(targetUserId, 'team-member-removed', {
      teamId: team.id,
      teamName: team.name,
    });

    return { removed: true };
  }

  async join(userId: string, dto: JoinTeamDto) {
    const team = await this.prisma.team.findUnique({
      where: { inviteCode: dto.inviteCode.trim() },
    });
    if (!team) throw new NotFoundException('Invalid invite code');
    await this.prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: team.id, userId } },
      create: { teamId: team.id, userId, role: TeamRole.member },
      update: {},
    });
    await this.prisma.teamJoinRequest.deleteMany({
      where: { teamId: team.id, userId },
    });
    await this.prisma.teamInvite.updateMany({
      where: {
        teamId: team.id,
        inviteeId: userId,
        status: TeamInviteStatus.pending,
      },
      data: { status: TeamInviteStatus.accepted },
    });

    const facilitatorIds = await this.facilitatorUserIds(team.id);
    this.events.emitToUsers(facilitatorIds, 'team-invite-resolved', {
      id: '',
      teamId: team.id,
      teamName: team.name,
      accepted: true,
      inviteeId: userId,
    });

    return this.getOne(userId, team.id);
  }

  async requestJoinFromRetro(userId: string, retroId: string) {
    const retro = await this.prisma.retrospective.findUnique({
      where: { id: retroId },
      include: { team: { select: { id: true, name: true } } },
    });
    if (!retro) throw new NotFoundException('Retrospective not found');

    const membership = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: retro.teamId, userId } },
    });
    if (membership) {
      throw new BadRequestException('Ya sos miembro de este equipo');
    }

    const existing = await this.prisma.teamJoinRequest.findUnique({
      where: { teamId_userId: { teamId: retro.teamId, userId } },
      include: { user: { select: joinRequestUserSelect } },
    });
    if (existing) {
      return this.toJoinRequestDto(existing, retro.team.name);
    }

    const created = await this.prisma.teamJoinRequest.create({
      data: { teamId: retro.teamId, userId },
      include: { user: { select: joinRequestUserSelect } },
    });
    const payload = this.toJoinRequestDto(created, retro.team.name);
    const facilitatorIds = await this.facilitatorUserIds(retro.teamId);
    this.events.emitToUsers(facilitatorIds, 'team-join-request', payload);
    return payload;
  }

  async acceptJoinRequest(actorId: string, teamId: string, requestId: string) {
    await this.assertFacilitatorOrAdmin(actorId, teamId);
    const request = await this.prisma.teamJoinRequest.findUnique({
      where: { id: requestId },
    });
    if (!request || request.teamId !== teamId) {
      throw new NotFoundException('Solicitud no encontrada');
    }
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { name: true },
    });
    await this.prisma.$transaction([
      this.prisma.teamMember.upsert({
        where: { teamId_userId: { teamId, userId: request.userId } },
        create: { teamId, userId: request.userId, role: TeamRole.member },
        update: {},
      }),
      this.prisma.teamJoinRequest.delete({ where: { id: request.id } }),
    ]);
    await this.emitJoinResolved(teamId, request.id, request.userId, true, team?.name);
    return { accepted: true };
  }

  async rejectJoinRequest(actorId: string, teamId: string, requestId: string) {
    await this.assertFacilitatorOrAdmin(actorId, teamId);
    const request = await this.prisma.teamJoinRequest.findUnique({
      where: { id: requestId },
    });
    if (!request || request.teamId !== teamId) {
      throw new NotFoundException('Solicitud no encontrada');
    }
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { name: true },
    });
    await this.prisma.teamJoinRequest.delete({ where: { id: request.id } });
    await this.emitJoinResolved(
      teamId,
      request.id,
      request.userId,
      false,
      team?.name,
    );
    return { rejected: true };
  }

  async assertMember(userId: string, teamId: string) {
    const membership = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!membership) throw new ForbiddenException('Not a team member');
    return membership;
  }

  async assertMemberOrAdmin(userId: string, teamId: string) {
    if (await this.isAdmin(userId)) {
      return this.prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId } },
      });
    }
    return this.assertMember(userId, teamId);
  }

  async assertMemberOrThrowJoinDenied(userId: string, teamId: string) {
    if (await this.isAdmin(userId)) {
      const membership = await this.prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId } },
      });
      return membership;
    }
    const membership = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (membership) return membership;

    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, name: true },
    });
    const pending = await this.prisma.teamJoinRequest.findUnique({
      where: { teamId_userId: { teamId, userId } },
      select: { id: true },
    });
    throw new ForbiddenException({
      code: 'NOT_TEAM_MEMBER',
      message: 'No sos miembro del equipo',
      teamId,
      teamName: team?.name ?? '',
      pendingRequest: !!pending,
    });
  }

  async assertFacilitator(userId: string, teamId: string) {
    const membership = await this.assertMember(userId, teamId);
    if (membership.role !== TeamRole.facilitator) {
      throw new ForbiddenException('Facilitator role required');
    }
    return membership;
  }

  async assertFacilitatorOrAdmin(userId: string, teamId: string) {
    if (await this.isAdmin(userId)) {
      return this.prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId } },
      });
    }
    return this.assertFacilitator(userId, teamId);
  }

  async assertAdmin(userId: string) {
    if (!(await this.isAdmin(userId))) {
      throw new ForbiddenException('Admin role required');
    }
  }

  async isAdmin(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });
    return !!user?.isAdmin;
  }

  async assertAnyFacilitator(userId: string) {
    const membership = await this.prisma.teamMember.findFirst({
      where: { userId, role: TeamRole.facilitator },
    });
    if (!membership) {
      throw new ForbiddenException('Facilitator role required');
    }
    return membership;
  }

  async isFacilitatorAnywhere(userId: string): Promise<boolean> {
    const membership = await this.prisma.teamMember.findFirst({
      where: { userId, role: TeamRole.facilitator },
      select: { id: true },
    });
    return !!membership;
  }

  /** Member can mutate action if they created it or are the assigned owner. */
  async assertCanMutateAction(
    userId: string,
    teamId: string,
    action: { createdById: string | null; ownerId: string | null },
  ) {
    if (await this.isAdmin(userId)) return;
    const membership = await this.assertMember(userId, teamId);
    if (membership.role === TeamRole.facilitator) return;
    if (action.createdById === userId || action.ownerId === userId) return;
    throw new ForbiddenException(
      'Solo podés editar acciones que creaste o que te asignaron',
    );
  }

  async listUsersForAdmin(actorId: string) {
    await this.assertAdmin(actorId);
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        avatarId: true,
        isAdmin: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteUserAsAdmin(actorId: string, targetUserId: string) {
    await this.assertAdmin(actorId);
    if (actorId === targetUserId) {
      throw new BadRequestException('No podés borrar tu propia cuenta');
    }
    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, isAdmin: true },
    });
    if (!target) throw new NotFoundException('Usuario no encontrado');
    if (target.isAdmin) {
      throw new BadRequestException('No se puede borrar al administrador');
    }
    await this.prisma.$transaction([
      this.prisma.template.deleteMany({
        where: {
          createdById: targetUserId,
          isGlobal: false,
          retrospectives: { none: {} },
        },
      }),
      this.prisma.actionItem.updateMany({
        where: { ownerId: targetUserId },
        data: { ownerId: null },
      }),
      this.prisma.actionItem.updateMany({
        where: { createdById: targetUserId },
        data: { createdById: null },
      }),
      this.prisma.participant.updateMany({
        where: { userId: targetUserId },
        data: { userId: null },
      }),
      this.prisma.user.delete({ where: { id: targetUserId } }),
    ]);
    return { deleted: true };
  }

  private async facilitatorUserIds(teamId: string) {
    const rows = await this.prisma.teamMember.findMany({
      where: { teamId, role: TeamRole.facilitator },
      select: { userId: true },
    });
    return rows.map((row) => row.userId);
  }

  private async emitTeamInviteResolved(
    teamId: string,
    payload: {
      id: string;
      teamId: string;
      teamName: string;
      accepted: boolean;
      inviteeId: string;
    },
  ) {
    const facilitatorIds = await this.facilitatorUserIds(teamId);
    this.events.emitToUsers(facilitatorIds, 'team-invite-resolved', payload);
  }

  private async emitJoinResolved(
    teamId: string,
    requestId: string,
    userId: string,
    accepted: boolean,
    teamName?: string,
  ) {
    const facilitatorIds = await this.facilitatorUserIds(teamId);
    this.events.emitToUsers(facilitatorIds, 'team-join-request-resolved', {
      id: requestId,
      teamId,
      accepted,
      userId,
    });
    this.events.emitToUser(
      userId,
      accepted ? 'team-join-accepted' : 'team-join-rejected',
      { teamId, teamName: teamName ?? '' },
    );
  }

  private withMappedRetros<
    T extends {
      retrospectives: Array<{
        closedAt: Date | null;
        currentPhase: { id: string; name: string; kind: string } | null;
        participants: Array<{
          id: string;
          guestName: string | null;
          isGuest: boolean;
          avatarId: string | null;
          user: { id: string; name: string; avatarId: string | null } | null;
        }>;
      }>;
    },
  >(team: T) {
    return {
      ...team,
      retrospectives: team.retrospectives.map(({ participants, ...retro }) => ({
        ...retro,
        closed: !!retro.closedAt,
        currentPhaseName: retro.currentPhase?.name ?? null,
        currentPhaseKind: retro.currentPhase?.kind ?? null,
        participants: participants.map((p) => ({
          id: p.id,
          name:
            p.guestName ??
            p.user?.name ??
            (p.isGuest ? 'Invitado' : 'Participante'),
          avatarId: resolveParticipantAvatar(p),
          ownerId: p.user?.id ?? p.id,
        })),
      })),
    };
  }

  private toJoinRequestDto(
    request: {
      id: string;
      teamId: string;
      createdAt: Date;
      user: { id: string; name: string; email: string; avatarId: string | null };
    },
    teamName: string,
  ) {
    return {
      id: request.id,
      teamId: request.teamId,
      teamName,
      createdAt: request.createdAt,
      user: request.user,
    };
  }
}
