import { randomUUID } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtPayload } from '../auth/jwt.strategy';
import { RealtimeEventsService } from './realtime-events.service';

const CONFETTI_COOLDOWN_MS = 1000;

type PresenceParticipant = {
  participantId: string;
  name: string;
  avatarId?: string | null;
  userId?: string | null;
};

type JoinRetroBody = {
  retroId: string;
  participantId?: string;
  name?: string;
  avatarId?: string | null;
};

type SocketPresenceData = {
  userId?: string;
  participantId?: string;
  name?: string;
  avatarId?: string | null;
  type?: JwtPayload['type'];
  guestRetroId?: string;
  retroId?: string;
};

@WebSocketGateway({
  cors: { origin: '*' },
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly lastConfettiAt = new Map<string, number>();

  constructor(
    private readonly events: RealtimeEventsService,
    private readonly jwt: JwtService,
  ) {}

  afterInit(server: Server) {
    this.events.setServer(server);
  }

  handleConnection(client: Socket) {
    const token = client.handshake.auth?.token;
    if (typeof token !== 'string' || !token) return;
    try {
      const payload = this.jwt.verify<JwtPayload>(token);
      const data = client.data as SocketPresenceData;
      if (payload?.type === 'user' && payload.sub) {
        data.userId = payload.sub;
        data.name = payload.name;
        data.avatarId = payload.avatarId ?? null;
        data.type = 'user';
        void client.join(`user:${payload.sub}`);
      } else if (payload?.type === 'guest' && payload.sub) {
        data.participantId = payload.participantId ?? payload.sub;
        data.name = payload.name;
        data.avatarId = payload.avatarId ?? null;
        data.guestRetroId = payload.retroId;
        data.type = 'guest';
      }
    } catch {
      // guests and invalid tokens can still join retro rooms
    }
  }

  handleDisconnect(client: Socket) {
    this.lastConfettiAt.delete(client.id);
    const data = client.data as SocketPresenceData;
    const retroId = data.retroId;
    if (retroId) {
      data.retroId = undefined;
      void this.broadcastPresence(retroId);
    }
  }

  @SubscribeMessage('join-retro')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: JoinRetroBody,
  ) {
    if (!body?.retroId) return { ok: false };
    const data = client.data as SocketPresenceData;

    if (data.type === 'guest' && data.guestRetroId && data.guestRetroId !== body.retroId) {
      return { ok: false };
    }

    const previousRetroId = data.retroId;
    if (previousRetroId && previousRetroId !== body.retroId) {
      await client.leave(`retro:${previousRetroId}`);
      data.retroId = undefined;
      await this.broadcastPresence(previousRetroId);
    }

    if (typeof body.participantId === 'string' && body.participantId.trim()) {
      data.participantId = body.participantId.trim();
    }
    if (typeof body.name === 'string' && body.name.trim()) {
      data.name = body.name.trim();
    }
    if (body.avatarId !== undefined) {
      data.avatarId = body.avatarId;
    }

    await client.join(`retro:${body.retroId}`);
    data.retroId = body.retroId;
    await this.broadcastPresence(body.retroId);
    return { ok: true };
  }

  @SubscribeMessage('leave-retro')
  async handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { retroId: string },
  ) {
    if (!body?.retroId) return { ok: false };
    const data = client.data as SocketPresenceData;
    await client.leave(`retro:${body.retroId}`);
    if (data.retroId === body.retroId) {
      data.retroId = undefined;
    }
    await this.broadcastPresence(body.retroId);
    return { ok: true };
  }

  @SubscribeMessage('throw-confetti')
  handleThrowConfetti(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { retroId?: string; id?: string },
  ) {
    const retroId = body?.retroId?.trim();
    if (!retroId) return { ok: false };
    const room = `retro:${retroId}`;
    if (!client.rooms.has(room)) return { ok: false };

    const now = Date.now();
    const last = this.lastConfettiAt.get(client.id) ?? 0;
    if (now - last < CONFETTI_COOLDOWN_MS) return { ok: false };
    this.lastConfettiAt.set(client.id, now);

    const id =
      typeof body.id === 'string' && body.id.length > 0 && body.id.length <= 64
        ? body.id
        : randomUUID();
    this.server.to(room).emit('confetti', { id });
    return { ok: true };
  }

  private async broadcastPresence(retroId: string) {
    const room = `retro:${retroId}`;
    const sockets = await this.server.in(room).fetchSockets();
    const byParticipant = new Map<string, PresenceParticipant>();

    for (const sock of sockets) {
      const data = sock.data as SocketPresenceData;
      const participantId = data.participantId?.trim();
      if (!participantId) continue;
      const name = (data.name ?? '').trim() || 'Participante';
      byParticipant.set(participantId, {
        participantId,
        name,
        avatarId: data.avatarId ?? null,
        userId: data.userId ?? null,
      });
    }

    this.server.to(room).emit('presence-updated', {
      participants: [...byParticipant.values()],
    });
  }
}
