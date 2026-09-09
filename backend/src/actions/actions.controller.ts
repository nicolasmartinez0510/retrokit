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

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { ActionsService } from './actions.service';
import { CreateTeamActionDto, UpdateActionDto } from './dto/action.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class ActionsController {
  constructor(private readonly actionsService: ActionsService) {}

  @Get('teams/:teamId/actions')
  list(@CurrentUser() user: JwtPayload, @Param('teamId') teamId: string) {
    return this.actionsService.listForTeam(user.sub, teamId);
  }

  @Post('teams/:teamId/actions')
  create(
    @CurrentUser() user: JwtPayload,
    @Param('teamId') teamId: string,
    @Body() dto: CreateTeamActionDto,
  ) {
    return this.actionsService.createForTeam(user.sub, teamId, dto);
  }

  @Patch('teams/:teamId/actions/:actionId')
  updateForTeam(
    @CurrentUser() user: JwtPayload,
    @Param('teamId') teamId: string,
    @Param('actionId') actionId: string,
    @Body() dto: UpdateActionDto,
  ) {
    return this.actionsService.updateForTeam(
      user.sub,
      teamId,
      actionId,
      dto,
    );
  }

  @Patch('actions/:actionId')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('actionId') actionId: string,
    @Body() dto: UpdateActionDto,
  ) {
    return this.actionsService.update(user.sub, actionId, dto);
  }

  @Delete('actions/:actionId')
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('actionId') actionId: string,
  ) {
    return this.actionsService.remove(user.sub, actionId);
  }
}
