import { ExceptionFilter, Catch, ArgumentsHost, PayloadTooLargeException } from '@nestjs/common';
import { Response } from 'express';

@Catch(PayloadTooLargeException)
export class UploadTooLargeFilter implements ExceptionFilter {
  catch(_exception: PayloadTooLargeException, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    res.status(413).json({
      statusCode: 413,
      message:
        'El archivo es demasiado pesado. Logos hasta 1 MB; fondos hasta 5 MB. PNG, JPEG, WebP o SVG.',
    });
  }
}
