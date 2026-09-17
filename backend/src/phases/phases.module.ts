import { Module } from '@nestjs/common';
import { TeamsModule } from '../teams/teams.module';
import { PhasesController } from './phases.controller';
import { PhasesService } from './phases.service';

@Module({
  imports: [TeamsModule],
  controllers: [PhasesController],
  providers: [PhasesService],
  exports: [PhasesService],
})
export class PhasesModule {}
