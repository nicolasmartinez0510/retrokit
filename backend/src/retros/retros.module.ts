import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TeamsModule } from '../teams/teams.module';
import { RetroEventsService } from './retro-events.service';
import { RetroGateway } from './retro.gateway';
import { RetrosController } from './retros.controller';
import { RetrosService } from './retros.service';

@Module({
  imports: [AuthModule, TeamsModule],
  controllers: [RetrosController],
  providers: [RetrosService, RetroEventsService, RetroGateway],
  exports: [RetrosService, RetroEventsService],
})
export class RetrosModule {}
