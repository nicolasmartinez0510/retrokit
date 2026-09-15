import { Module } from '@nestjs/common';
import { TeamsController, UsersController } from './teams.controller';
import { TeamsService } from './teams.service';

@Module({
  controllers: [TeamsController, UsersController],
  providers: [TeamsService],
  exports: [TeamsService],
})
export class TeamsModule {}
