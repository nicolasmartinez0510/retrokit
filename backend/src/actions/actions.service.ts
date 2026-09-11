import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TeamsService } from '../teams/teams.service';
import { userOwnerSelect } from '../common/avatars';
import { CreateTeamActionDto, UpdateActionDto } from './dto/action.dto';

@Injectable()
export class ActionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teams: TeamsService,
  ) {}

  async listForTeam(userId: string, teamId: string) {
    await this.teams.assertMember(userId, teamId);
    return this.prisma.actionItem.findMany({
      where: { teamId },
      include: {
        owner: { select: userOwnerSelect },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async createForTeam(
    userId: string,
    teamId: string,
    dto: CreateTeamActionDto,
  ) {
    await this.teams.assertMember(userId, teamId);
    return this.prisma.actionItem.create({
      data: {
        teamId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        ownerId: dto.ownerId || null,
      },
      include: {
        owner: { select: userOwnerSelect },
      },
    });
  }

  async update(userId: string, actionId: string, dto: UpdateActionDto) {
    const action = await this.prisma.actionItem.findUnique({
      where: { id: actionId },
    });
    if (!action) throw new NotFoundException('Action not found');
    await this.teams.assertMember(userId, action.teamId);

    return this.prisma.actionItem.update({
      where: { id: actionId },
      data: {
        ...(dto.title !== undefined && { title: dto.title.trim() }),
        ...(dto.description !== undefined && {
          description: dto.description.trim() || null,
        }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.ownerId !== undefined && { ownerId: dto.ownerId }),
      },
      include: {
        owner: { select: userOwnerSelect },
      },
    });
  }

  async updateForTeam(
    userId: string,
    teamId: string,
    actionId: string,
    dto: UpdateActionDto,
  ) {
    const action = await this.prisma.actionItem.findUnique({
      where: { id: actionId },
    });
    if (!action || action.teamId !== teamId) {
      throw new NotFoundException('Action not found');
    }
    return this.update(userId, actionId, dto);
  }

  async remove(userId: string, actionId: string) {
    const action = await this.prisma.actionItem.findUnique({
      where: { id: actionId },
    });
    if (!action) throw new NotFoundException('Action not found');
    await this.teams.assertFacilitator(userId, action.teamId);
    await this.prisma.actionItem.delete({ where: { id: actionId } });
    return { deleted: true };
  }
}
