import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/decorators';
import { JwtPayload } from '../auth/jwt.strategy';
import { UserAuthGuard } from '../auth/user-auth.guard';
import { UploadTooLargeFilter } from '../uploads/upload-too-large.filter';
import { LOGO_MAX_BYTES } from '../uploads/uploads.service';
import {
  CreateTeamDto,
  InviteTeamMemberDto,
  JoinTeamDto,
  RequestTeamJoinDto,
  SetTeamFavoriteDto,
  UpdateTeamDto,
} from './dto/teams.dto';
import { TeamsService } from './teams.service';

const logoInterceptor = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: LOGO_MAX_BYTES },
});

@Controller('teams')
@UseGuards(UserAuthGuard)
@UseFilters(UploadTooLargeFilter)
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.teams.listForUser(user.sub);
  }

  @Get('invites/incoming')
  incomingInvites(@CurrentUser() user: JwtPayload) {
    return this.teams.listIncomingInvites(user.sub);
  }

  @Post('invites/:inviteId/accept')
  acceptInvite(
    @CurrentUser() user: JwtPayload,
    @Param('inviteId') inviteId: string,
  ) {
    return this.teams.acceptInvite(user.sub, inviteId);
  }

  @Post('invites/:inviteId/reject')
  rejectInvite(
    @CurrentUser() user: JwtPayload,
    @Param('inviteId') inviteId: string,
  ) {
    return this.teams.rejectInvite(user.sub, inviteId);
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

  @Post(':id/invites')
  inviteMember(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: InviteTeamMemberDto,
  ) {
    return this.teams.inviteByEmail(user.sub, id, dto);
  }

  @Get(':id/invites')
  listOutgoingInvites(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.teams.listOutgoingInvites(user.sub, id);
  }

  @Delete(':id/invites/:inviteId')
  cancelInvite(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('inviteId') inviteId: string,
  ) {
    return this.teams.cancelInvite(user.sub, id, inviteId);
  }

  @Patch(':id/favorite')
  setFavorite(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: SetTeamFavoriteDto,
  ) {
    return this.teams.setFavorite(user.sub, id, dto.favorited);
  }

  @Post(':id/logo')
  @UseInterceptors(logoInterceptor)
  uploadLogo(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException(
        'No se recibió el archivo. El logo debe ser PNG, JPEG, WebP o SVG de hasta 1 MB.',
      );
    }
    return this.teams.uploadLogo(user.sub, id, file);
  }

  @Delete(':id/logo')
  deleteLogo(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.teams.deleteLogo(user.sub, id);
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

@Controller('users')
@UseGuards(UserAuthGuard)
export class UsersController {
  constructor(private readonly teams: TeamsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.teams.listUsersForAdmin(user.sub);
  }

  @Get('search')
  search(@CurrentUser() user: JwtPayload, @Query('email') email = '') {
    return this.teams.searchUsersByEmail(user.sub, email);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.teams.deleteUserAsAdmin(user.sub, id);
  }
}
