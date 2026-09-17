import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Phase, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  SemaforoItemInputDto,
  TemplatePhaseInputDto,
} from '../phases/dto/phases.dto';
import {
  DEFAULT_CLASSIC_PHASE_IDS,
  DEFAULT_SEMAFORO_ITEMS,
  PhaseKind,
} from '../retros/phase-rules';
import { TeamsService } from '../teams/teams.service';
import {
  isStagingPublicUrl,
  UploadsService,
} from '../uploads/uploads.service';
import {
  CreateTemplateDto,
  TemplateColumnInputDto,
  UpdateTemplateDto,
} from './dto/templates.dto';

const columnInclude = { orderBy: { position: 'asc' as const } };

const phaseInclude = {
  orderBy: { position: 'asc' as const },
  include: {
    phase: true,
    hiddenColumns: { select: { columnId: true } },
  },
} as const;

const semaforoInclude = { orderBy: { position: 'asc' as const } };

const createdBySelect = {
  id: true,
  name: true,
  email: true,
} as const;

const SEMAFORO_KINDS: PhaseKind[] = ['semaforo', 'semaforo_review'];

type PrismaTx = Prisma.TransactionClient;

@Injectable()
export class TemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teams: TeamsService,
    private readonly uploads: UploadsService,
  ) {}

  async list(userId: string) {
    const admin = await this.teams.isAdmin(userId);
    const where: Prisma.TemplateWhereInput = admin
      ? {}
      : { OR: [{ isGlobal: true }, { createdById: userId }] };

    const rows = await this.prisma.template.findMany({
      where,
      include: this.templateInclude(admin),
      orderBy: [{ isGlobal: 'desc' }, { name: 'asc' }],
    });
    return rows.map((t) => this.serializeTemplate(t));
  }

  async getOne(id: string, userId: string) {
    const admin = await this.teams.isAdmin(userId);
    const template = await this.prisma.template.findUnique({
      where: { id },
      include: this.templateInclude(admin),
    });
    if (!template) throw new NotFoundException('Plantilla no encontrada');
    if (
      !admin &&
      !template.isGlobal &&
      template.createdById !== userId
    ) {
      throw new NotFoundException('Plantilla no encontrada');
    }
    return this.serializeTemplate(template);
  }

  async create(userId: string, dto: CreateTemplateDto) {
    const admin = await this.teams.isAdmin(userId);
    if (!admin) {
      await this.teams.assertAnyFacilitator(userId);
    }
    this.assertValidColumns(dto.columns);
    await this.assertStagingAssets(userId, dto);

    const created = await this.prisma.$transaction(async (tx) => {
      const template = await tx.template.create({
        data: {
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          maxCommentsPerParticipant:
            dto.maxCommentsPerParticipant !== undefined
              ? dto.maxCommentsPerParticipant
              : 3,
          votesPerParticipant: dto.votesPerParticipant ?? 5,
          maxVotesPerCard: dto.maxVotesPerCard ?? 2,
          backgroundColor: dto.backgroundColor?.trim() || null,
          isGlobal: admin,
          createdById: userId,
          columns: {
            create: dto.columns.map((c, i) => this.columnData(c, i)),
          },
        },
        include: { columns: columnInclude },
      });

      const columnIds = template.columns.map((c) => c.id);
      if (dto.phases?.length) {
        await this.createPhasesFromDto(
          tx,
          userId,
          admin,
          template.id,
          columnIds,
          dto.phases,
        );
      } else {
        await this.seedDefaultPhases(tx, template.id);
      }

      await this.syncSemaforoItemsOnCreate(
        tx,
        template.id,
        dto.semaforoItems,
      );

      return template;
    });

    return this.applyStagingAssets(userId, created.id, dto);
  }

  async update(userId: string, id: string, dto: UpdateTemplateDto) {
    await this.assertCanManage(userId, id);
    const existing = await this.getOne(id, userId);

    if (dto.columns) {
      this.assertValidColumns(dto.columns);
    }
    await this.assertStagingAssets(userId, dto);

    const removedLogoUrls: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      await tx.template.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description?.trim() || null }
            : {}),
          ...(dto.maxCommentsPerParticipant !== undefined
            ? { maxCommentsPerParticipant: dto.maxCommentsPerParticipant }
            : {}),
          ...(dto.votesPerParticipant !== undefined
            ? { votesPerParticipant: dto.votesPerParticipant }
            : {}),
          ...(dto.maxVotesPerCard !== undefined
            ? { maxVotesPerCard: dto.maxVotesPerCard }
            : {}),
          ...(dto.backgroundColor !== undefined
            ? { backgroundColor: dto.backgroundColor?.trim() || null }
            : {}),
        },
      });

      if (dto.columns) {
        const incomingIds = dto.columns
          .map((c) => c.id)
          .filter((colId): colId is string => !!colId);
        const existingIds = existing.columns.map((c) => c.id);
        const toDelete = existing.columns.filter(
          (c) => !incomingIds.includes(c.id),
        );

        if (toDelete.length) {
          for (const col of toDelete) {
            if (col.logoUrl) removedLogoUrls.push(col.logoUrl);
          }
          await tx.templateColumn.deleteMany({
            where: { id: { in: toDelete.map((c) => c.id) }, templateId: id },
          });
        }

        for (let i = 0; i < dto.columns.length; i++) {
          const col = dto.columns[i];
          const data = this.columnData(col, i);
          if (col.id && existingIds.includes(col.id)) {
            const prev = existing.columns.find((c) => c.id === col.id);
            const extra =
              data.icon && prev?.logoUrl
                ? { logoUrl: null as string | null }
                : {};
            if ('logoUrl' in extra && extra.logoUrl === null && prev?.logoUrl) {
              removedLogoUrls.push(prev.logoUrl);
            }
            await tx.templateColumn.update({
              where: { id: col.id },
              data: { ...data, ...extra },
            });
          } else {
            await tx.templateColumn.create({
              data: { ...data, templateId: id },
            });
          }
        }
      }

      const columns = await tx.templateColumn.findMany({
        where: { templateId: id },
        orderBy: { position: 'asc' },
      });
      const columnIds = columns.map((c) => c.id);

      if (dto.phases) {
        await tx.templatePhase.deleteMany({ where: { templateId: id } });
        await this.createPhasesFromDto(
          tx,
          userId,
          await this.teams.isAdmin(userId),
          id,
          columnIds,
          dto.phases,
        );
      }

      if (dto.semaforoItems) {
        await tx.templateSemaforoItem.deleteMany({ where: { templateId: id } });
        await this.createSemaforoItems(tx, id, dto.semaforoItems);
      }
    });

    for (const url of removedLogoUrls) {
      await this.deleteFileIfUnreferenced(url);
    }

    return this.applyStagingAssets(userId, id, dto, existing.backgroundImageUrl);
  }

  async remove(userId: string, id: string) {
    await this.assertCanManage(userId, id);
    await this.getOne(id, userId);

    const inUse = await this.prisma.retrospective.count({
      where: { templateId: id },
    });
    if (inUse > 0) {
      throw new BadRequestException(
        'No se puede borrar: hay retrospectivas que usan esta plantilla',
      );
    }

    await this.prisma.template.delete({ where: { id } });
    await this.uploads.deleteTemplateDir(id);
    return { deleted: true };
  }

  async uploadBackground(userId: string, id: string, file: Express.Multer.File) {
    await this.assertCanManage(userId, id);
    const existing = await this.getOne(id, userId);
    const url = await this.uploads.saveTemplateBackground(id, file);
    await this.prisma.template.update({
      where: { id },
      data: { backgroundImageUrl: url },
    });
    await this.deleteFileIfUnreferenced(existing.backgroundImageUrl);
    return this.getOne(id, userId);
  }

  async clearBackground(userId: string, id: string) {
    await this.assertCanManage(userId, id);
    const existing = await this.getOne(id, userId);
    await this.prisma.template.update({
      where: { id },
      data: { backgroundImageUrl: null },
    });
    await this.deleteFileIfUnreferenced(existing.backgroundImageUrl);
    return this.getOne(id, userId);
  }

  async uploadColumnLogo(
    userId: string,
    templateId: string,
    columnId: string,
    file: Express.Multer.File,
  ) {
    await this.assertCanManage(userId, templateId);
    await this.getOne(templateId, userId);
    const column = await this.prisma.templateColumn.findFirst({
      where: { id: columnId, templateId },
    });
    if (!column) throw new NotFoundException('Columna no encontrada');

    const url = await this.uploads.saveColumnLogo(templateId, columnId, file);
    await this.prisma.templateColumn.update({
      where: { id: columnId },
      data: { logoUrl: url, icon: null },
    });
    await this.deleteFileIfUnreferenced(column.logoUrl);
    return this.getOne(templateId, userId);
  }

  async clearColumnLogo(userId: string, templateId: string, columnId: string) {
    await this.assertCanManage(userId, templateId);
    await this.getOne(templateId, userId);
    const column = await this.prisma.templateColumn.findFirst({
      where: { id: columnId, templateId },
    });
    if (!column) throw new NotFoundException('Columna no encontrada');

    await this.prisma.templateColumn.update({
      where: { id: columnId },
      data: { logoUrl: null },
    });
    await this.deleteFileIfUnreferenced(column.logoUrl);
    return this.getOne(templateId, userId);
  }

  async saveStaging(
    userId: string,
    sessionId: string,
    file: Express.Multer.File,
    kind: 'background' | 'logo',
  ) {
    await this.assertCanCreateTemplates(userId);
    const url = await this.uploads.saveStaging(userId, sessionId, file, kind);
    return { url };
  }

  async deleteStagingFile(userId: string, url: string) {
    await this.assertCanCreateTemplates(userId);
    if (!url) {
      throw new BadRequestException('La imagen temporal no es válida');
    }
    await this.uploads.deleteStaging(userId, url);
    return { deleted: true };
  }

  async deleteStagingSession(userId: string, sessionId: string) {
    await this.assertCanCreateTemplates(userId);
    await this.uploads.deleteStagingSession(userId, sessionId);
    return { deleted: true };
  }

  private templateInclude(admin: boolean) {
    return {
      columns: columnInclude,
      phases: phaseInclude,
      semaforoItems: semaforoInclude,
      ...(admin ? { createdBy: { select: createdBySelect } } : {}),
    };
  }

  private serializeTemplate<
    T extends {
      phases?: Array<{
        id: string;
        phaseId: string;
        position: number;
        phase: Phase;
        hiddenColumns?: Array<{ columnId: string }>;
      }>;
    },
  >(template: T) {
    return {
      ...template,
      phases: (template.phases ?? []).map((tp) => ({
        id: tp.id,
        phaseId: tp.phaseId,
        position: tp.position,
        hiddenColumnIds: (tp.hiddenColumns ?? []).map((h) => h.columnId),
        phase: tp.phase,
      })),
    };
  }

  private async createPhasesFromDto(
    tx: PrismaTx,
    userId: string,
    admin: boolean,
    templateId: string,
    columnIds: string[],
    phases: TemplatePhaseInputDto[],
  ) {
    if (!phases.length) {
      throw new BadRequestException('La plantilla necesita al menos una fase');
    }

    const ordered = [...phases].sort((a, b) => a.position - b.position);
    const phaseIds = ordered.map((p) => p.phaseId);
    if (new Set(phaseIds).size !== phaseIds.length) {
      throw new BadRequestException('No podés repetir la misma fase');
    }

    const columnIdSet = new Set(columnIds);
    if (!columnIds.length) {
      throw new BadRequestException('La plantilla necesita al menos una columna');
    }

    for (const entry of ordered) {
      const hidden = entry.hiddenColumnIds ?? [];
      const validHidden = hidden.filter((id) => columnIdSet.has(id));
      if (validHidden.length !== hidden.length) {
        throw new BadRequestException(
          'Hay columnas ocultas que no pertenecen a la plantilla',
        );
      }
      if (validHidden.length >= columnIds.length) {
        throw new BadRequestException(
          'Cada fase debe dejar al menos una columna visible',
        );
      }
    }

    const accessible = await tx.phase.findMany({
      where: {
        id: { in: phaseIds },
        ...(admin
          ? {}
          : {
              OR: [
                { isGlobal: true },
                { isSystem: true },
                { createdById: userId },
              ],
            }),
      },
    });
    const byId = new Map(accessible.map((p) => [p.id, p]));
    const missing = phaseIds.filter((id) => !byId.has(id));
    if (missing.length) {
      throw new NotFoundException(
        `Fase no encontrada: ${missing.join(', ')}`,
      );
    }

    for (const entry of ordered) {
      const hidden = (entry.hiddenColumnIds ?? []).filter((id) =>
        columnIdSet.has(id),
      );
      await tx.templatePhase.create({
        data: {
          templateId,
          phaseId: entry.phaseId,
          position: entry.position,
          hiddenColumns: {
            create: hidden.map((columnId) => ({ columnId })),
          },
        },
      });
    }
  }

  private async seedDefaultPhases(tx: PrismaTx, templateId: string) {
    const defaults = await tx.phase.findMany({
      where: { id: { in: [...DEFAULT_CLASSIC_PHASE_IDS] } },
    });
    const byId = new Map(defaults.map((p) => [p.id, p]));
    let position = 0;
    for (const phaseId of DEFAULT_CLASSIC_PHASE_IDS) {
      if (!byId.has(phaseId)) continue;
      await tx.templatePhase.create({
        data: { templateId, phaseId, position },
      });
      position += 1;
    }
    if (position === 0) {
      throw new BadRequestException(
        'No hay fases disponibles; ejecutá las migraciones del sistema',
      );
    }
  }

  private async syncSemaforoItemsOnCreate(
    tx: PrismaTx,
    templateId: string,
    semaforoItems: SemaforoItemInputDto[] | undefined,
  ) {
    if (semaforoItems?.length) {
      await this.createSemaforoItems(tx, templateId, semaforoItems);
      return;
    }

    const templatePhases = await tx.templatePhase.findMany({
      where: { templateId },
      include: { phase: true },
    });
    const hasSemaforo = templatePhases.some((tp) =>
      SEMAFORO_KINDS.includes(tp.phase.kind as PhaseKind),
    );
    if (!hasSemaforo) return;

    await this.createSemaforoItems(
      tx,
      templateId,
      DEFAULT_SEMAFORO_ITEMS.map((item, position) => ({
        title: item.title,
        description: item.description,
        position,
      })),
    );
  }

  private async createSemaforoItems(
    tx: PrismaTx,
    templateId: string,
    items: SemaforoItemInputDto[],
  ) {
    const ordered = [...items].sort((a, b) => a.position - b.position);
    for (const item of ordered) {
      await tx.templateSemaforoItem.create({
        data: {
          templateId,
          title: item.title.trim(),
          description: item.description?.trim() || null,
          position: item.position,
        },
      });
    }
  }

  private async assertCanCreateTemplates(userId: string) {
    if (await this.teams.isAdmin(userId)) return;
    await this.teams.assertAnyFacilitator(userId);
  }

  private async assertCanManage(userId: string, templateId: string) {
    if (await this.teams.isAdmin(userId)) return;
    const template = await this.prisma.template.findUnique({
      where: { id: templateId },
      select: { createdById: true },
    });
    if (!template) throw new NotFoundException('Plantilla no encontrada');
    if (template.createdById !== userId) {
      throw new ForbiddenException('No podés editar esta plantilla');
    }
  }

  private async assertStagingAssets(
    userId: string,
    dto: {
      backgroundImageUrl?: string | null;
      columns?: TemplateColumnInputDto[];
    },
  ) {
    if (isStagingPublicUrl(dto.backgroundImageUrl)) {
      await this.uploads.assertStagingFileExists(userId, dto.backgroundImageUrl);
    } else if (dto.backgroundImageUrl) {
      throw new BadRequestException('La imagen temporal no es válida');
    }
    for (const col of dto.columns ?? []) {
      if (!col.logoUrl) continue;
      if (isStagingPublicUrl(col.logoUrl)) {
        await this.uploads.assertStagingFileExists(userId, col.logoUrl);
      }
    }
  }

  private async applyStagingAssets(
    userId: string,
    templateId: string,
    dto: {
      backgroundImageUrl?: string | null;
      columns?: TemplateColumnInputDto[];
    },
    previousBackgroundUrl?: string | null,
  ) {
    if (isStagingPublicUrl(dto.backgroundImageUrl)) {
      const url = await this.uploads.promoteStaging(
        userId,
        dto.backgroundImageUrl,
        templateId,
        'bg',
      );
      await this.prisma.template.update({
        where: { id: templateId },
        data: { backgroundImageUrl: url },
      });
      if (previousBackgroundUrl) {
        await this.deleteFileIfUnreferenced(previousBackgroundUrl);
      }
    }

    if (dto.columns?.length) {
      const persisted = await this.prisma.templateColumn.findMany({
        where: { templateId },
        orderBy: { position: 'asc' },
      });
      for (let i = 0; i < dto.columns.length; i++) {
        const incoming = dto.columns[i];
        if (!isStagingPublicUrl(incoming.logoUrl)) continue;
        const column =
          (incoming.id
            ? persisted.find((c) => c.id === incoming.id)
            : undefined) ??
          persisted.find((c) => c.position === (incoming.position ?? i)) ??
          persisted[i];
        if (!column) {
          throw new BadRequestException('Columna no encontrada');
        }
        const url = await this.uploads.promoteStaging(
          userId,
          incoming.logoUrl,
          templateId,
          `col-${column.id}`,
        );
        await this.prisma.templateColumn.update({
          where: { id: column.id },
          data: { logoUrl: url, icon: null },
        });
      }
    }

    return this.getOne(templateId, userId);
  }

  private async deleteFileIfUnreferenced(url: string | null | undefined) {
    if (!url) return;
    const [templates, templateCols, retros, retroCols] = await Promise.all([
      this.prisma.template.count({ where: { backgroundImageUrl: url } }),
      this.prisma.templateColumn.count({ where: { logoUrl: url } }),
      this.prisma.retrospective.count({ where: { backgroundImageUrl: url } }),
      this.prisma.retroColumn.count({ where: { logoUrl: url } }),
    ]);
    if (templates + templateCols + retros + retroCols > 0) return;
    await this.uploads.deleteByPublicUrl(url);
  }

  private columnData(c: TemplateColumnInputDto, index: number) {
    return {
      title: c.title.trim(),
      description: c.description?.trim() || null,
      icon: c.icon?.trim() || null,
      position: c.position ?? index,
    };
  }

  private assertValidColumns(columns: TemplateColumnInputDto[]) {
    if (!columns.length) {
      throw new BadRequestException('La plantilla necesita al menos una columna');
    }
    if (columns.length > 8) {
      throw new BadRequestException('Máximo 8 columnas por plantilla');
    }
    for (const c of columns) {
      if (!c.title?.trim()) {
        throw new BadRequestException('Cada columna necesita un título');
      }
    }
  }
}
