import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class RealtimeEventsService {
  private server: Server | null = null;

  setServer(server: Server) {
    this.server = server;
  }

  emit(retroId: string, event: string, payload: unknown) {
    this.server?.to(`retro:${retroId}`).emit(event, payload);
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }

  emitToUsers(userIds: string[], event: string, payload: unknown) {
    const unique = [...new Set(userIds.filter(Boolean))];
    for (const userId of unique) {
      this.emitToUser(userId, event, payload);
    }
  }
}
