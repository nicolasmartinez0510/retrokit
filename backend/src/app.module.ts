import { Controller, Get, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ActionsModule } from './actions/actions.module';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { RetrosModule } from './retros/retros.module';
import { TeamsModule } from './teams/teams.module';
import { TemplatesModule } from './templates/templates.module';
import { UploadsModule } from './uploads/uploads.module';

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
    UploadsModule,
    AuthModule,
    TeamsModule,
    TemplatesModule,
    RetrosModule,
    ActionsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
