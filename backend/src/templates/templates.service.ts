import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TeamsService } from '../teams/teams.service';
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

    return this.prisma.$transaction(async (tx) => {
      if (dto.name !== undefined || dto.description !== undefined) {
        await tx.template.update({
          where: { id },
          data: {
            ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
            ...(dto.description !== undefined
              ? { description: dto.description?.trim() || null }
              : {}),
          },
        });
      }

      if (dto.columns) {
        const incomingIds = dto.columns
          .map((c) => c.id)
          .filter((colId): colId is string => !!colId);
        const existingIds = existing.columns.map((c) => c.id);
        const toDelete = existingIds.filter((colId) => !incomingIds.includes(colId));

        if (toDelete.length) {
          await tx.templateColumn.deleteMany({
            where: { id: { in: toDelete }, templateId: id },
          });
        }

        for (let i = 0; i < dto.columns.length; i++) {
          const col = dto.columns[i];
          const data = this.columnData(col, i);
          if (col.id && existingIds.includes(col.id)) {
            await tx.templateColumn.update({
              where: { id: col.id },
              data,
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
    return { deleted: true };
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
