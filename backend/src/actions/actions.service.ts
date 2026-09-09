// This file is part of Retrokit.
//
// Copyright (C) 2026 Nicolas Martinez
//
// Retrokit is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Retrokit is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Retrokit.  If not, see <https://www.gnu.org/licenses/>.

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TeamsService } from '../teams/teams.service';
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
        owner: { select: { id: true, name: true } },
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
        owner: { select: { id: true, name: true } },
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
        owner: { select: { id: true, name: true } },
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
    await this.teams.assertMember(userId, action.teamId);
    await this.prisma.actionItem.delete({ where: { id: actionId } });
    return { deleted: true };
  }
}
