import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/decorators';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import {
  CARD_IMAGE_MAX_BYTES,
  CARD_IMAGE_MIMES,
} from '../uploads/uploads.service';
import {
  AdvancePhaseDto,
  CreateActionFromRetroDto,
  CreateCardDto,
  CreateRetroDto,
  GroupCardsDto,
  JoinRetroDto,
  RotiDto,
  SetCommentsReadyDto,
  TimerDto,
  UpdateCardDto,
  UpdateSettingsDto,
  VoteDto,
} from './dto/retros.dto';
import { RetrosService } from './retros.service';

const cardImageInterceptor = FileInterceptor('image', {
  storage: memoryStorage(),
  limits: { fileSize: CARD_IMAGE_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!CARD_IMAGE_MIMES.has(file.mimetype)) {
      return cb(
        new BadRequestException('Solo se permiten PNG, JPEG, WebP o GIF') as unknown as Error,
        false,
      );
    }
    cb(null, true);
  },
});

@Controller('retros')
export class RetrosController {
  constructor(private readonly retros: RetrosService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateRetroDto) {
    return this.retros.create(user.sub, dto);
  }

  @Post('join')
  @UseGuards(OptionalJwtAuthGuard)
  join(@CurrentUser() user: JwtPayload, @Body() dto: JoinRetroDto) {
    return this.retros.join(user, dto);
  }

  @Post(':id/join')
  @UseGuards(JwtAuthGuard)
  joinById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.retros.joinById(user, id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  getOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.retros.getOne(user, id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.retros.remove(user, id);
  }

  @Patch(':id/settings')
  @UseGuards(JwtAuthGuard)
  updateSettings(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.retros.updateSettings(user, id, dto);
  }

  @Post(':id/phase')
  @UseGuards(JwtAuthGuard)
  advancePhase(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AdvancePhaseDto,
  ) {
    return this.retros.advancePhase(user, id, dto.status);
  }

  @Patch(':id/me/ready')
  @UseGuards(JwtAuthGuard)
  setCommentsReady(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: SetCommentsReadyDto,
  ) {
    return this.retros.setCommentsReady(user, id, dto.ready);
  }

  @Post(':id/cards')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(cardImageInterceptor)
  createCard(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateCardDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.retros.createCard(user, id, dto, file);
  }

  @Patch(':id/cards/:cardId')
  @UseGuards(JwtAuthGuard)
  updateCard(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('cardId') cardId: string,
    @Body() dto: UpdateCardDto,
  ) {
    return this.retros.updateCard(user, id, cardId, dto);
  }

  @Post(':id/cards/:cardId/image')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(cardImageInterceptor)
  setCardImage(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('cardId') cardId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }
    return this.retros.setCardImage(user, id, cardId, file);
  }

  @Delete(':id/cards/:cardId/image')
  @UseGuards(JwtAuthGuard)
  deleteCardImage(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('cardId') cardId: string,
  ) {
    return this.retros.deleteCardImage(user, id, cardId);
  }

  @Delete(':id/cards/:cardId')
  @UseGuards(JwtAuthGuard)
  deleteCard(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('cardId') cardId: string,
  ) {
    return this.retros.deleteCard(user, id, cardId);
  }

  @Post(':id/groups')
  @UseGuards(JwtAuthGuard)
  groupCards(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: GroupCardsDto,
  ) {
    return this.retros.groupCards(user, id, dto);
  }

  @Post(':id/group')
  @UseGuards(JwtAuthGuard)
  groupCardsAlias(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: GroupCardsDto,
  ) {
    return this.retros.groupCards(user, id, dto);
  }

  @Post(':id/votes')
  @UseGuards(JwtAuthGuard)
  setVote(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: VoteDto,
  ) {
    return this.retros.setVote(user, id, dto);
  }

  @Post(':id/timer/start')
  @UseGuards(JwtAuthGuard)
  startTimer(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: TimerDto,
  ) {
    return this.retros.startTimer(user, id, dto);
  }

  @Post(':id/timer/stop')
  @UseGuards(JwtAuthGuard)
  stopTimer(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.retros.stopTimer(user, id);
  }

  @Post(':id/roti')
  @UseGuards(JwtAuthGuard)
  submitRoti(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: RotiDto,
  ) {
    return this.retros.submitRoti(user, id, dto);
  }

  @Get(':id/report')
  @UseGuards(JwtAuthGuard)
  report(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.retros.report(user, id);
  }

  @Post(':id/actions')
  @UseGuards(JwtAuthGuard)
  createAction(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateActionFromRetroDto,
  ) {
    return this.retros.createAction(user, id, dto);
  }
}
