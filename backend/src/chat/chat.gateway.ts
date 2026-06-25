import {
  BadRequestException,
  ConflictException,
  HttpException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { AUTH_ACCESS_TOKEN_COOKIE } from '../auth/auth-cookie.constants';
import { AuthProvider, UserRole } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AccessTokenPayload,
  AuthenticatedUser,
} from '../auth/types/authenticated-user';
import { ChatService, type ChatMessageResult } from './chat.service';

const CHAT_NAMESPACE = '/chat';
const ADMIN_CHAT_ROOM = 'admin:chats';
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const socketUserSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  role: true,
  authProvider: true,
  isActive: true,
} as const;

type ChatSocket = Socket & {
  data: {
    conversationId?: string;
    user?: AuthenticatedUser;
  };
};

interface SocketErrorPayload {
  code: string;
  message: string;
}

type SocketCorsOriginCallback = (error: Error | null, allow?: boolean) => void;

function getSocketCorsOrigins(): string[] | false {
  const origins = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.includes('*')) {
    throw new Error(
      'CORS_ORIGIN must list explicit origins when credentials are enabled.',
    );
  }

  return origins.length > 0 ? origins : false;
}

function isSocketCorsOriginAllowed(
  origin: string | undefined,
  callback: SocketCorsOriginCallback,
) {
  const corsOrigins = getSocketCorsOrigins();

  if (!origin) {
    callback(null, true);
    return;
  }

  if (corsOrigins === false) {
    callback(null, false);
    return;
  }

  callback(null, corsOrigins.includes(origin));
}

@WebSocketGateway({
  cors: {
    credentials: true,
    origin: isSocketCorsOriginAllowed,
  },
  namespace: CHAT_NAMESPACE,
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server?: Server;

  constructor(
    private readonly chatService: ChatService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prismaService: PrismaService,
  ) {}

  async handleConnection(client: ChatSocket) {
    try {
      const user = await this.authenticateSocket(client);

      client.data.user = user;

      if (user.role === UserRole.ADMIN) {
        await client.join(ADMIN_CHAT_ROOM);
        return;
      }

      if (user.role === UserRole.CUSTOMER) {
        const conversation =
          await this.chatService.getCustomerSocketConversation(user);

        client.data.conversationId = conversation.id;
        await client.join(this.getConversationRoom(conversation.id));
        client.emit('chat:conversationUpdated', conversation);
        return;
      }

      throw new ConflictException({
        code: 'CHAT_ROLE_UNSUPPORTED',
        message: 'This account cannot connect to chat.',
      });
    } catch (error) {
      this.emitSafeError(client, error);
      client.disconnect(true);
    }
  }

  handleDisconnect(_client: ChatSocket) {
    return undefined;
  }

  @SubscribeMessage('chat:send')
  async handleSendMessage(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() payload: unknown,
  ) {
    try {
      const user = this.getSocketUser(client);
      const body = this.getPayloadString(payload, 'body');
      const result =
        user.role === UserRole.ADMIN
          ? await this.chatService.sendAdminMessage(
              user,
              this.getPayloadConversationId(payload),
              body,
            )
          : await this.chatService.sendCustomerMessage(user, body);

      this.broadcastMessageResult(result);

      return { ok: true, data: result };
    } catch (error) {
      const safeError = this.toSafeError(error);

      client.emit('chat:error', safeError);
      return { ok: false, error: safeError };
    }
  }

  @SubscribeMessage('chat:joinConversation')
  async handleJoinConversation(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() payload: unknown,
  ) {
    try {
      this.assertAdminSocket(client);
      const conversationId = this.getPayloadConversationId(payload);
      const conversation =
        await this.chatService.getConversationForAdminRoom(conversationId);

      await client.join(this.getConversationRoom(conversationId));
      client.emit('chat:conversationUpdated', conversation);

      return { ok: true, data: { conversation } };
    } catch (error) {
      const safeError = this.toSafeError(error);

      client.emit('chat:error', safeError);
      return { ok: false, error: safeError };
    }
  }

  @SubscribeMessage('chat:leaveConversation')
  async handleLeaveConversation(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() payload: unknown,
  ) {
    try {
      this.assertAdminSocket(client);
      const conversationId = this.getPayloadConversationId(payload);

      await client.leave(this.getConversationRoom(conversationId));

      return { ok: true };
    } catch (error) {
      const safeError = this.toSafeError(error);

      client.emit('chat:error', safeError);
      return { ok: false, error: safeError };
    }
  }

  broadcastMessageResult(result: ChatMessageResult) {
    if (!this.server) {
      return;
    }

    this.server
      .to(this.getConversationRoom(result.message.conversationId))
      .emit('chat:message', result.message);
    this.server
      .to(ADMIN_CHAT_ROOM)
      .emit('chat:conversationUpdated', result.conversation);
  }

  private async authenticateSocket(
    client: ChatSocket,
  ): Promise<AuthenticatedUser> {
    const token = this.extractSocketToken(client);

    if (!token) {
      throw new UnauthorizedException({
        code: 'AUTH_REQUIRED',
        message: 'Authentication is required.',
      });
    }

    const payload = await this.verifyToken(token);

    if (payload.type !== 'access' || !payload.sub) {
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN',
        message: 'Authentication token is invalid or expired.',
      });
    }

    const user = await this.prismaService.user.findUnique({
      where: { id: payload.sub },
      select: socketUserSelect,
    });

    if (!user) {
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN',
        message: 'Authentication token is invalid or expired.',
      });
    }

    if (!user.isActive) {
      throw new UnauthorizedException({
        code: 'ACCOUNT_INACTIVE',
        message: 'Account is inactive.',
      });
    }

    return {
      authProvider: user.authProvider as AuthProvider,
      email: user.email,
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
    };
  }

  private extractSocketToken(client: ChatSocket): string | undefined {
    const token = client.handshake.auth?.token;

    if (typeof token === 'string' && token.trim()) {
      return token.trim();
    }

    return this.getCookie(
      client.handshake.headers.cookie,
      AUTH_ACCESS_TOKEN_COOKIE,
    );
  }

  private getCookie(
    cookieHeader: string | string[] | undefined,
    name: string,
  ): string | undefined {
    const header = Array.isArray(cookieHeader)
      ? cookieHeader.join(';')
      : cookieHeader;

    if (!header) {
      return undefined;
    }

    for (const cookie of header.split(';')) {
      const [rawName, ...rawValue] = cookie.trim().split('=');

      if (rawName === name) {
        try {
          return decodeURIComponent(rawValue.join('='));
        } catch {
          return undefined;
        }
      }
    }

    return undefined;
  }

  private async verifyToken(token: string): Promise<AccessTokenPayload> {
    const secret = this.configService.get<string>('JWT_SECRET')?.trim();

    if (!secret) {
      throw new InternalServerErrorException({
        code: 'AUTH_CONFIGURATION_ERROR',
        message: 'Authentication is not configured.',
      });
    }

    try {
      return await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret,
      });
    } catch {
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN',
        message: 'Authentication token is invalid or expired.',
      });
    }
  }

  private getSocketUser(client: ChatSocket): AuthenticatedUser {
    if (!client.data.user) {
      throw new UnauthorizedException({
        code: 'AUTH_REQUIRED',
        message: 'Authentication is required.',
      });
    }

    return client.data.user;
  }

  private assertAdminSocket(client: ChatSocket) {
    const user = this.getSocketUser(client);

    if (user.role !== UserRole.ADMIN) {
      throw new UnauthorizedException({
        code: 'CHAT_ADMIN_REQUIRED',
        message: 'An admin account is required for this chat action.',
      });
    }
  }

  private getPayloadString(payload: unknown, key: string): string {
    if (
      typeof payload !== 'object' ||
      payload === null ||
      !(key in payload)
    ) {
      return '';
    }

    const value = (payload as Record<string, unknown>)[key];

    return typeof value === 'string' ? value : '';
  }

  private getPayloadConversationId(payload: unknown): string {
    const conversationId = this.getPayloadString(payload, 'conversationId');

    if (!UUID_PATTERN.test(conversationId)) {
      throw new BadRequestException({
        code: 'CHAT_CONVERSATION_INVALID',
        message: 'Conversation ID is invalid.',
      });
    }

    return conversationId;
  }

  private getConversationRoom(conversationId: string): string {
    return `conversation:${conversationId}`;
  }

  private emitSafeError(client: ChatSocket, error: unknown) {
    client.emit('chat:error', this.toSafeError(error));
  }

  private toSafeError(error: unknown): SocketErrorPayload {
    if (error instanceof HttpException) {
      const status = error.getStatus();
      const response = error.getResponse();

      if (status >= 500) {
        return {
          code: 'CHAT_SERVER_ERROR',
          message: 'Chat is unavailable right now.',
        };
      }

      if (typeof response === 'object' && response !== null) {
        const body = response as { code?: unknown; message?: unknown };
        const code = typeof body.code === 'string' ? body.code : 'CHAT_ERROR';
        const message =
          typeof body.message === 'string'
            ? body.message
            : 'Chat request failed.';

        return { code, message };
      }

      return {
        code: 'CHAT_ERROR',
        message: typeof response === 'string' ? response : 'Chat request failed.',
      };
    }

    return {
      code: 'CHAT_ERROR',
      message: 'Chat request failed.',
    };
  }
}
