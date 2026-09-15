import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TeamsService } from '../teams/teams.service';
import { RealtimeEventsService } from '../realtime/realtime-events.service';
import {
  actionItemInclude,
  parseOptionalDueDate,
  serializeActionItem,
} from '../common/action-item';
import { CreateTeamActionDto, UpdateActionDto } from './dto/action.dto';

@Injectable()
export class ActionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teams: TeamsService,
    private readonly events: RealtimeEventsService,
  ) {}

  async listForTeam(userId: string, teamId: string) {
    await this.teams.assertMemberOrAdmin(userId, teamId);
    const items = await this.prisma.actionItem.findMany({
      where: { teamId },
      include: actionItemInclude,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
    return items.map(serializeActionItem);
  }

  async createForTeam(
    userId: string,
    teamId: string,
    dto: CreateTeamActionDto,
  ) {
    await this.teams.assertMemberOrAdmin(userId, teamId);
    const retro = await this.prisma.retrospective.findFirst({
      where: { id: dto.retroId, teamId },
      select: { id: true },
    });
    if (!retro) {
      throw new BadRequestException('Retrospective not found');
    }
    const action = await this.prisma.actionItem.create({
      data: {
        teamId,
        retroId: retro.id,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        ownerId: dto.ownerId || null,
        createdById: userId,
        dueDate: parseOptionalDueDate(dto.dueDate) ?? null,
      },
      include: actionItemInclude,
    });
    const payload = serializeActionItem(action);
    this.events.emitToTeam(teamId, 'action-created', payload);
    return payload;
  }

  async update(userId: string, actionId: string, dto: UpdateActionDto) {
    const action = await this.prisma.actionItem.findUnique({
      where: { id: actionId },
    });
    if (!action) throw new NotFoundException('Action not found');
    await this.teams.assertCanMutateAction(userId, action.teamId, action);

    const dueDate = parseOptionalDueDate(dto.dueDate);

    const updated = await this.prisma.actionItem.update({
      where: { id: actionId },
      data: {
        ...(dto.title !== undefined && { title: dto.title.trim() }),
        ...(dto.description !== undefined && {
          description: dto.description.trim() || null,
        }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.ownerId !== undefined && { ownerId: dto.ownerId }),
        ...(dueDate !== undefined && { dueDate }),
      },
      include: actionItemInclude,
    });
    const payload = serializeActionItem(updated);
    this.events.emitToTeam(action.teamId, 'action-updated', payload);
    return payload;
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
    await this.teams.assertCanMutateAction(userId, action.teamId, action);
    await this.prisma.actionItem.delete({ where: { id: actionId } });
    this.events.emitToTeam(action.teamId, 'action-deleted', {
      id: actionId,
      teamId: action.teamId,
    });
    return { deleted: true };
  }
}
