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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { ActionsService } from './actions.service';
import { CreateTeamActionDto, UpdateActionDto } from './dto/action.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class ActionsController {
  constructor(private readonly actionsService: ActionsService) {}

  @Get('teams/:teamId/actions')
  list(@CurrentUser() user: JwtPayload, @Param('teamId') teamId: string) {
    return this.actionsService.listForTeam(user.sub, teamId);
  }

  @Post('teams/:teamId/actions')
  create(
    @CurrentUser() user: JwtPayload,
    @Param('teamId') teamId: string,
    @Body() dto: CreateTeamActionDto,
  ) {
    return this.actionsService.createForTeam(user.sub, teamId, dto);
  }

  @Patch('teams/:teamId/actions/:actionId')
  updateForTeam(
    @CurrentUser() user: JwtPayload,
    @Param('teamId') teamId: string,
    @Param('actionId') actionId: string,
    @Body() dto: UpdateActionDto,
  ) {
    return this.actionsService.updateForTeam(
      user.sub,
      teamId,
      actionId,
      dto,
    );
  }

  @Patch('actions/:actionId')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('actionId') actionId: string,
    @Body() dto: UpdateActionDto,
  ) {
    return this.actionsService.update(user.sub, actionId, dto);
  }

  @Delete('actions/:actionId')
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('actionId') actionId: string,
  ) {
    return this.actionsService.remove(user.sub, actionId);
  }
}
