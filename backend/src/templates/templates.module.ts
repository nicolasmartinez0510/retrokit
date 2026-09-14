import { Module } from '@nestjs/common';
import { TeamsModule } from '../teams/teams.module';
import { TemplatesStagingController } from './templates-staging.controller';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';

@Module({
  imports: [TeamsModule],
  controllers: [TemplatesStagingController, TemplatesController],
  providers: [TemplatesService],
  exports: [TemplatesService],
})
export class TemplatesModule {}
