import { Module } from '@nestjs/common';
import { TeamsModule } from '../teams/teams.module';
import { ActionProgressService } from './action-progress.service';
import { ActionsController } from './actions.controller';
import { ActionsService } from './actions.service';

@Module({
  imports: [TeamsModule],
  controllers: [ActionsController],
  providers: [ActionsService, ActionProgressService],
  exports: [ActionsService],
})
export class ActionsModule {}
