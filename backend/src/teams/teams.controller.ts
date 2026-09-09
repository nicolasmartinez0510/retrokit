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
import { JwtPayload } from '../auth/jwt.strategy';
import { UserAuthGuard } from '../auth/user-auth.guard';
import {
  CreateTeamDto,
  JoinTeamDto,
  UpdateTeamDto,
} from './dto/teams.dto';
import { TeamsService } from './teams.service';

@Controller('teams')
@UseGuards(UserAuthGuard)
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.teams.listForUser(user.sub);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateTeamDto) {
    return this.teams.create(user.sub, dto);
  }

  @Post('join')
  join(@CurrentUser() user: JwtPayload, @Body() dto: JoinTeamDto) {
    return this.teams.join(user.sub, dto);
  }

  @Get(':id')
  getOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.teams.getOne(user.sub, id);
  }

  @Get(':id/members')
  members(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.teams.listMembers(user.sub, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTeamDto,
  ) {
    return this.teams.update(user.sub, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.teams.remove(user.sub, id);
  }
}
