import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { UserAuthGuard } from '../auth/user-auth.guard';
import { CreatePhaseDto, UpdatePhaseDto } from './dto/phases.dto';
import { PhasesService } from './phases.service';

@Controller('phases')
@UseGuards(JwtAuthGuard, UserAuthGuard)
export class PhasesController {
  constructor(private readonly phases: PhasesService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.phases.list(user.sub);
  }

  @Get(':id')
  getOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.phases.getOne(id, user.sub);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreatePhaseDto) {
    return this.phases.create(user.sub, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdatePhaseDto,
  ) {
    return this.phases.update(user.sub, id, dto);
  }

  @Post(':id/duplicate')
  duplicate(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.phases.duplicate(user.sub, id);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('force') force?: string,
  ) {
    return this.phases.remove(user.sub, id, {
      force: force === '1' || force === 'true',
    });
  }
}
