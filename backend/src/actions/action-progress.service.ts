import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TeamsService } from '../teams/teams.service';
import { RealtimeEventsService } from '../realtime/realtime-events.service';
import {
  actionProgressInclude,
  progressTitleFor,
  serializeActionProgress,
} from '../common/action-progress';
import {
  CreateActionProgressDto,
  UpdateActionProgressDto,
} from './dto/action.dto';

@Injectable()
export class ActionProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teams: TeamsService,
    private readonly events: RealtimeEventsService,
  ) {}

  async listForAction(userId: string, actionId: string) {
    const action = await this.findAction(actionId);
    await this.teams.assertMemberOrAdmin(userId, action.teamId);
    const updates = await this.prisma.actionProgressUpdate.findMany({
      where: { actionId },
      include: actionProgressInclude,
      orderBy: { sequence: 'asc' },
    });
    return updates.map(serializeActionProgress);
  }

  async create(userId: string, actionId: string, dto: CreateActionProgressDto) {
    const action = await this.findAction(actionId);
    await this.teams.assertCanMutateAction(userId, action.teamId, action);
    const { progress, pending } = this.parseContent(dto);

    const created = await this.prisma.$transaction(async (tx) => {
      const last = await tx.actionProgressUpdate.findFirst({
        where: { actionId },
        orderBy: { sequence: 'desc' },
        select: { sequence: true },
      });
      const sequence = (last?.sequence ?? 0) + 1;
      return tx.actionProgressUpdate.create({
        data: {
          actionId,
          authorId: userId,
          sequence,
          title: progressTitleFor(sequence),
          entryMode: dto.entryMode,
          entryModeCustom: this.parseCustomMode(dto),
          progress,
          pending,
        },
        include: actionProgressInclude,
      });
    });

    const payload = serializeActionProgress(created);
    this.events.emitToTeam(action.teamId, 'action-progress-created', {
      actionId,
      teamId: action.teamId,
      update: payload,
    });
    return payload;
  }

  async update(
    userId: string,
    updateId: string,
    dto: UpdateActionProgressDto,
  ) {
    const existing = await this.prisma.actionProgressUpdate.findUnique({
      where: { id: updateId },
      select: { id: true, actionId: true },
    });
    if (!existing) throw new NotFoundException('Progress update not found');
    const action = await this.findAction(existing.actionId);
    await this.teams.assertCanMutateAction(userId, action.teamId, action);
    const { progress, pending } = this.parseContent(dto);

    const updated = await this.prisma.actionProgressUpdate.update({
      where: { id: updateId },
      data: {
        entryMode: dto.entryMode,
        entryModeCustom: this.parseCustomMode(dto),
        progress,
        pending,
      },
      include: actionProgressInclude,
    });

    const payload = serializeActionProgress(updated);
    this.events.emitToTeam(action.teamId, 'action-progress-updated', {
      actionId: action.id,
      teamId: action.teamId,
      update: payload,
    });
    return payload;
  }

  async remove(userId: string, updateId: string) {
    const existing = await this.prisma.actionProgressUpdate.findUnique({
      where: { id: updateId },
      select: { id: true, actionId: true },
    });
    if (!existing) throw new NotFoundException('Progress update not found');
    const action = await this.findAction(existing.actionId);
    await this.teams.assertCanMutateAction(userId, action.teamId, action);

    await this.prisma.actionProgressUpdate.delete({ where: { id: updateId } });
    this.events.emitToTeam(action.teamId, 'action-progress-deleted', {
      id: updateId,
      actionId: action.id,
      teamId: action.teamId,
    });
    return { deleted: true };
  }

  private async findAction(actionId: string) {
    const action = await this.prisma.actionItem.findUnique({
      where: { id: actionId },
      select: {
        id: true,
        teamId: true,
        ownerId: true,
        createdById: true,
      },
    });
    if (!action) throw new NotFoundException('Action not found');
    return action;
  }

  private parseContent(dto: CreateActionProgressDto) {
    const progress = dto.progress?.trim() || null;
    const pending = dto.pending?.trim() || null;
    if (!progress && !pending) {
      throw new BadRequestException(
        'Escribí al menos un avance o un pendiente',
      );
    }
    return { progress, pending };
  }

  private parseCustomMode(dto: CreateActionProgressDto) {
    if (dto.entryMode !== 'otro') return null;
    return dto.entryModeCustom?.trim() || null;
  }
}
