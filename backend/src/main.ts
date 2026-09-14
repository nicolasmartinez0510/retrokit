import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { Response } from 'express';
import { mkdir } from 'fs/promises';
import { resolve } from 'path';
import { AppModule } from './app.module';

function svgUploadHeaders(res: Response, filePath: string) {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.svg')) {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Content-Disposition', 'attachment');
  }
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: true,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const uploadDir = resolve(process.env.UPLOAD_DIR || './uploads');
  const stagingDir = resolve(uploadDir, '.tmp');
  await mkdir(stagingDir, { recursive: true });
  app.useStaticAssets(uploadDir, {
    prefix: '/api/uploads/',
    setHeaders: svgUploadHeaders,
  });
  app.useStaticAssets(stagingDir, {
    prefix: '/api/uploads/tmp/',
    setHeaders: svgUploadHeaders,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Retrokit API listening on http://localhost:${port}/api`);
}
void bootstrap();
