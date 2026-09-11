import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TeamsModule } from '../teams/teams.module';
import { RetrosController } from './retros.controller';
import { RetrosService } from './retros.service';

@Module({
  imports: [AuthModule, TeamsModule],
  controllers: [RetrosController],
  providers: [RetrosService],
  exports: [RetrosService],
})
export class RetrosModule {}
