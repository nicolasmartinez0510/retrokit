import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TeamRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeamDto, JoinTeamDto, UpdateTeamDto } from './dto/teams.dto';

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, dto: CreateTeamDto) {
    return this.prisma.team.create({
      data: {
        name: dto.name.trim(),
        members: {
          create: { userId, role: TeamRole.facilitator },
        },
      },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        retrospectives: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
            closedAt: true,
          },
        },
      },
    });
  }

  async listForUser(userId: string) {
    const teams = await this.prisma.team.findMany({
      where: { members: { some: { userId } } },
      include: {
        _count: { select: { members: true, retrospectives: true } },
        members: {
          where: { userId },
          select: { role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return teams.map((t) => ({
      ...t,
      role: t.members[0]?.role,
    }));
  }

  async getOne(userId: string, teamId: string) {
    await this.assertMember(userId, teamId);
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { id: 'asc' },
        },
        retrospectives: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
            closedAt: true,
          },
        },
      },
    });
    if (!team) throw new NotFoundException('Team not found');
    return team;
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
        user: { select: { id: true, name: true, email: true } },
      },
    });
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
    return this.getOne(userId, team.id);
  }

  async assertMember(userId: string, teamId: string) {
    const membership = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!membership) throw new ForbiddenException('Not a team member');
    return membership;
  }

  async assertFacilitator(userId: string, teamId: string) {
    const membership = await this.assertMember(userId, teamId);
    if (membership.role !== TeamRole.facilitator) {
      throw new ForbiddenException('Facilitator role required');
    }
    return membership;
  }
}
