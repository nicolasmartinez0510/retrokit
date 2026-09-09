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

import { Controller, Get, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ActionsModule } from './actions/actions.module';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { RetrosModule } from './retros/retros.module';
import { TeamsModule } from './teams/teams.module';
import { TemplatesModule } from './templates/templates.module';

@Controller('health')
class HealthController {
  @Get()
  check() {
    return { status: 'ok', service: 'retrokit-api' };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    TeamsModule,
    TemplatesModule,
    RetrosModule,
    ActionsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
