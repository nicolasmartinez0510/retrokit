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
import { CreateTemplateDto, UpdateTemplateDto } from './dto/templates.dto';
import { TemplatesService } from './templates.service';

const backgroundInterceptor = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: BACKGROUND_MAX_BYTES },
});

const logoInterceptor = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: LOGO_MAX_BYTES },
});

@Controller('templates')
@UseGuards(UserAuthGuard)
@UseFilters(UploadTooLargeFilter)
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Get()
  list() {
    return this.templates.list();
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.templates.getOne(id);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateTemplateDto) {
    return this.templates.create(user.sub, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.templates.update(user.sub, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.templates.remove(user.sub, id);
  }

  @Post(':id/background')
  @UseInterceptors(backgroundInterceptor)
  uploadBackground(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException(
        'No se recibió el archivo. El fondo debe ser PNG, JPEG, WebP o SVG de hasta 5 MB.',
      );
    }
    return this.templates.uploadBackground(user.sub, id, file);
  }

  @Delete(':id/background')
  clearBackground(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.templates.clearBackground(user.sub, id);
  }

  @Post(':id/columns/:columnId/logo')
  @UseInterceptors(logoInterceptor)
  uploadColumnLogo(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('columnId') columnId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException(
        'No se recibió el archivo. El logo debe ser PNG, JPEG, WebP o SVG de hasta 1 MB.',
      );
    }
    return this.templates.uploadColumnLogo(user.sub, id, columnId, file);
  }

  @Delete(':id/columns/:columnId/logo')
  clearColumnLogo(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('columnId') columnId: string,
  ) {
    return this.templates.clearColumnLogo(user.sub, id, columnId);
  }
}
