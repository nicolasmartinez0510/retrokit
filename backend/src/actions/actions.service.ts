import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TeamsService } from '../teams/teams.service';
import { RealtimeEventsService } from '../realtime/realtime-events.service';
import { expireOverdueActions } from '../common/action-expiry';
import {
  actionItemInclude,
  parseOptionalDueDate,
  serializeActionItem,
  statusForDueDate,
} from '../common/action-item';
import { CreateTeamActionDto, UpdateActionDto } from './dto/action.dto';

const EXPIRE_INTERVAL_MS = 60 * 60 * 1000;

@Injectable()
export class ActionsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ActionsService.name);
  private expireTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly teams: TeamsService,
    private readonly events: RealtimeEventsService,
  ) {}

  onModuleInit() {
    void this.expireAllOverdue();
    this.expireTimer = setInterval(
      () => void this.expireAllOverdue(),
      EXPIRE_INTERVAL_MS,
    );
  }

  onModuleDestroy() {
    if (this.expireTimer) clearInterval(this.expireTimer);
  }

  async listForTeam(userId: string, teamId: string) {
    await this.teams.assertMemberOrAdmin(userId, teamId);
    await this.expireOverdueForTeam(teamId);
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
    const dueDate = parseOptionalDueDate(dto.dueDate) ?? null;
    const action = await this.prisma.actionItem.create({
      data: {
        teamId,
        retroId: retro.id,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        ownerId: dto.ownerId || null,
        createdById: userId,
        dueDate,
        status: statusForDueDate(dueDate),
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
    const nextDueDate = dueDate === undefined ? action.dueDate : dueDate;
    const nextStatus =
      dto.status !== undefined
        ? statusForDueDate(nextDueDate, dto.status)
        : statusForDueDate(nextDueDate, action.status);

    const updated = await this.prisma.actionItem.update({
      where: { id: actionId },
      data: {
        ...(dto.title !== undefined && { title: dto.title.trim() }),
        ...(dto.description !== undefined && {
          description: dto.description.trim() || null,
        }),
        ...(dto.ownerId !== undefined && { ownerId: dto.ownerId }),
        ...(dueDate !== undefined && { dueDate }),
        status: nextStatus,
      },
      include: actionItemInclude,
    });
    const payload = serializeActionItem(updated);
    this.emitActionUpdated(payload);
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

  async expireOverdueForTeam(teamId: string) {
    const expired = await expireOverdueActions(this.prisma, { teamId });
    for (const item of expired) {
      this.emitActionUpdated(serializeActionItem(item));
    }
    return expired;
  }

  private async expireAllOverdue() {
    try {
      const expired = await expireOverdueActions(this.prisma);
      for (const item of expired) {
        this.emitActionUpdated(serializeActionItem(item));
      }
      if (expired.length) {
        this.logger.log(`Marked ${expired.length} overdue action(s) as unmet`);
      }
    } catch (error) {
      this.logger.warn(
        `Failed to expire overdue actions: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private emitActionUpdated(
    payload: ReturnType<typeof serializeActionItem>,
  ) {
    this.events.emitToTeam(payload.teamId, 'action-updated', payload);
    if (payload.retroId) {
      this.events.emit(payload.retroId, 'action-updated', payload);
    }
  }
}
