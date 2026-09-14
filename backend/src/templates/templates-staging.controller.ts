import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Param,
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
import {
  BACKGROUND_MAX_BYTES,
  LOGO_MAX_BYTES,
} from '../uploads/uploads.service';
import { TemplatesService } from './templates.service';

const backgroundInterceptor = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: BACKGROUND_MAX_BYTES },
});

const logoInterceptor = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: LOGO_MAX_BYTES },
});

function requireSessionId(sessionId: string | undefined) {
  if (!sessionId?.trim()) {
    throw new BadRequestException('Sesión de imágenes inválida');
  }
  return sessionId.trim();
}

@Controller('templates/staging')
@UseGuards(UserAuthGuard)
@UseFilters(UploadTooLargeFilter)
export class TemplatesStagingController {
  constructor(private readonly templates: TemplatesService) {}

  @Post('background')
  @UseInterceptors(backgroundInterceptor)
  uploadBackground(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
    @Body('sessionId') sessionId: string,
  ) {
    if (!file) {
      throw new BadRequestException(
        'No se recibió el archivo. El fondo debe ser PNG, JPEG, WebP o SVG de hasta 5 MB.',
      );
    }
    return this.templates.saveStaging(
      user.sub,
      requireSessionId(sessionId),
      file,
      'background',
    );
  }

  @Post('logo')
  @UseInterceptors(logoInterceptor)
  uploadLogo(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
    @Body('sessionId') sessionId: string,
  ) {
    if (!file) {
      throw new BadRequestException(
        'No se recibió el archivo. El logo debe ser PNG, JPEG, WebP o SVG de hasta 1 MB.',
      );
    }
    return this.templates.saveStaging(
      user.sub,
      requireSessionId(sessionId),
      file,
      'logo',
    );
  }

  @Delete('sessions/:sessionId')
  deleteSession(
    @CurrentUser() user: JwtPayload,
    @Param('sessionId') sessionId: string,
  ) {
    return this.templates.deleteStagingSession(user.sub, sessionId);
  }

  @Delete()
  deleteFile(@CurrentUser() user: JwtPayload, @Query('url') url: string) {
    if (!url) {
      throw new BadRequestException('La imagen temporal no es válida');
    }
    return this.templates.deleteStagingFile(user.sub, url);
  }
}
