import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TeamsService } from '../teams/teams.service';
import { UploadsService } from '../uploads/uploads.service';
import {
  CreateTemplateDto,
  TemplateColumnInputDto,
  UpdateTemplateDto,
} from './dto/templates.dto';

const columnInclude = { orderBy: { position: 'asc' as const } };

@Injectable()
export class TemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teams: TeamsService,
    private readonly uploads: UploadsService,
  ) {}

  list() {
    return this.prisma.template.findMany({
      include: { columns: columnInclude },
      orderBy: { name: 'asc' },
    });
  }

  async getOne(id: string) {
    const template = await this.prisma.template.findUnique({
      where: { id },
      include: { columns: columnInclude },
    });
    if (!template) throw new NotFoundException('Plantilla no encontrada');
    return template;
  }

  async create(userId: string, dto: CreateTemplateDto) {
    await this.teams.assertAnyFacilitator(userId);
    this.assertValidColumns(dto.columns);

    return this.prisma.template.create({
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
        columns: {
          create: dto.columns.map((c, i) => this.columnData(c, i)),
        },
      },
      include: { columns: columnInclude },
    });
  }

  async update(userId: string, id: string, dto: UpdateTemplateDto) {
    await this.teams.assertAnyFacilitator(userId);
    const existing = await this.getOne(id);

    if (dto.columns) {
      this.assertValidColumns(dto.columns);
    }

    const removedLogoUrls: string[] = [];

    const updated = await this.prisma.$transaction(async (tx) => {
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

      return tx.template.findUniqueOrThrow({
        where: { id },
        include: { columns: columnInclude },
      });
    });

    for (const url of removedLogoUrls) {
      await this.deleteFileIfUnreferenced(url);
    }

    return updated;
  }

  async remove(userId: string, id: string) {
    await this.teams.assertAnyFacilitator(userId);
    await this.getOne(id);

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
    await this.teams.assertAnyFacilitator(userId);
    const existing = await this.getOne(id);
    const url = await this.uploads.saveTemplateBackground(id, file);
    const updated = await this.prisma.template.update({
      where: { id },
      data: { backgroundImageUrl: url },
      include: { columns: columnInclude },
    });
    await this.deleteFileIfUnreferenced(existing.backgroundImageUrl);
    return updated;
  }

  async clearBackground(userId: string, id: string) {
    await this.teams.assertAnyFacilitator(userId);
    const existing = await this.getOne(id);
    const updated = await this.prisma.template.update({
      where: { id },
      data: { backgroundImageUrl: null },
      include: { columns: columnInclude },
    });
    await this.deleteFileIfUnreferenced(existing.backgroundImageUrl);
    return updated;
  }

  async uploadColumnLogo(
    userId: string,
    templateId: string,
    columnId: string,
    file: Express.Multer.File,
  ) {
    await this.teams.assertAnyFacilitator(userId);
    await this.getOne(templateId);
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
    return this.getOne(templateId);
  }

  async clearColumnLogo(userId: string, templateId: string, columnId: string) {
    await this.teams.assertAnyFacilitator(userId);
    await this.getOne(templateId);
    const column = await this.prisma.templateColumn.findFirst({
      where: { id: columnId, templateId },
    });
    if (!column) throw new NotFoundException('Columna no encontrada');

    await this.prisma.templateColumn.update({
      where: { id: columnId },
      data: { logoUrl: null },
    });
    await this.deleteFileIfUnreferenced(column.logoUrl);
    return this.getOne(templateId);
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
