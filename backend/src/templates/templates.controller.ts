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
import { CreateTemplateDto, UpdateTemplateDto } from './dto/templates.dto';
import { TemplatesService } from './templates.service';

@Controller('templates')
@UseGuards(UserAuthGuard)
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
}
