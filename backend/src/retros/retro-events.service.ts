import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class RetroEventsService {
  private server: Server | null = null;

  setServer(server: Server) {
    this.server = server;
  }

  emit(retroId: string, event: string, payload: unknown) {
    this.server?.to(`retro:${retroId}`).emit(event, payload);
  }
}
