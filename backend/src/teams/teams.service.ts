import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TeamRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeEventsService } from '../realtime/realtime-events.service';
import {
  resolveParticipantAvatar,
  userPublicSelect,
} from '../common/avatars';
import { CreateTeamDto, JoinTeamDto, UpdateTeamDto } from './dto/teams.dto';

const joinRequestUserSelect = userPublicSelect;
const MAX_FAVORITE_TEAMS = 3;

const retroSummarySelect = {
  id: true,
  title: true,
  status: true,
  createdAt: true,
  closedAt: true,
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
    return this.withMappedRetros(team);
  }

  async listForUser(userId: string) {
    const teams = await this.prisma.team.findMany({
      where: { members: { some: { userId } } },
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

    return teams.map((t) => {
      const membership = t.members[0];
      const role = membership?.role;
      const favoritedAt = membership?.favoritedAt ?? null;
      const { _count, members, ...rest } = t;
      return {
        ...rest,
        role,
        favorited: !!favoritedAt,
        favoritedAt,
        members: members.map(({ role: memberRole }) => ({ role: memberRole })),
        _count: {
          members: _count.members,
          retrospectives: _count.retrospectives,
        },
        pendingJoinCount:
          role === TeamRole.facilitator ? _count.joinRequests : 0,
      };
    });
  }

  async getOne(userId: string, teamId: string) {
    const membership = await this.assertMember(userId, teamId);
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
    const favorited = !!membership.favoritedAt;
    const members = team.members.map(({ favoritedAt: _favoritedAt, ...member }) => member);
    const mapped = this.withMappedRetros({ ...team, members });
    if (membership.role !== TeamRole.facilitator) {
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
    await this.assertFacilitator(userId, teamId);
    await this.prisma.team.update({
      where: { id: teamId },
      data: { name: dto.name?.trim() },
    });
    return this.getOne(userId, teamId);
  }

  async remove(userId: string, teamId: string) {
    await this.assertFacilitator(userId, teamId);
    await this.prisma.team.delete({ where: { id: teamId } });
    return { deleted: true };
  }

  async listMembers(userId: string, teamId: string) {
    await this.assertMember(userId, teamId);
    return this.prisma.teamMember.findMany({
      where: { teamId },
      include: {
        user: { select: userPublicSelect },
      },
    });
  }

  async removeMember(actorId: string, teamId: string, targetUserId: string) {
    await this.assertFacilitator(actorId, teamId);
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

    await this.prisma.teamMember.delete({
      where: { teamId_userId: { teamId, userId: targetUserId } },
    });

    const remaining = await this.prisma.teamMember.count({
      where: { userId: targetUserId },
    });
    let accountDeleted = false;
    if (remaining === 0) {
      await this.prisma.user.delete({ where: { id: targetUserId } });
      accountDeleted = true;
    }

    return { removed: true, accountDeleted };
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
    await this.assertFacilitator(actorId, teamId);
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
    await this.assertFacilitator(actorId, teamId);
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

  async assertMemberOrThrowJoinDenied(userId: string, teamId: string) {
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

  private async facilitatorUserIds(teamId: string) {
    const rows = await this.prisma.teamMember.findMany({
      where: { teamId, role: TeamRole.facilitator },
      select: { userId: true },
    });
    return rows.map((row) => row.userId);
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
