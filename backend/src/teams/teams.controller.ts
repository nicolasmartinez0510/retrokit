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
import { JwtPayload } from '../auth/jwt.strategy';
import { UserAuthGuard } from '../auth/user-auth.guard';
import {
  CreateTeamDto,
  JoinTeamDto,
  RequestTeamJoinDto,
  UpdateTeamDto,
} from './dto/teams.dto';
import { TeamsService } from './teams.service';

@Controller('teams')
@UseGuards(UserAuthGuard)
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.teams.listForUser(user.sub);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateTeamDto) {
    return this.teams.create(user.sub, dto);
  }

  @Post('join')
  join(@CurrentUser() user: JwtPayload, @Body() dto: JoinTeamDto) {
    return this.teams.join(user.sub, dto);
  }

  @Post('join-requests')
  requestJoin(
    @CurrentUser() user: JwtPayload,
    @Body() dto: RequestTeamJoinDto,
  ) {
    return this.teams.requestJoinFromRetro(user.sub, dto.retroId);
  }

  @Post(':id/join-requests/:requestId/accept')
  acceptJoinRequest(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('requestId') requestId: string,
  ) {
    return this.teams.acceptJoinRequest(user.sub, id, requestId);
  }

  @Post(':id/join-requests/:requestId/reject')
  rejectJoinRequest(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('requestId') requestId: string,
  ) {
    return this.teams.rejectJoinRequest(user.sub, id, requestId);
  }

  @Get(':id')
  getOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.teams.getOne(user.sub, id);
  }

  @Get(':id/members')
  members(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.teams.listMembers(user.sub, id);
  }

  @Delete(':id/members/:userId')
  removeMember(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.teams.removeMember(user.sub, id, userId);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTeamDto,
  ) {
    return this.teams.update(user.sub, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.teams.remove(user.sub, id);
  }
}
