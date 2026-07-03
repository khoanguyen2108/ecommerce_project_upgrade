import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import {
  ChatSenderRole,
  ChatStatus,
  UserRole,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import type { SupportResponseDto } from '../ai/dto/support.dto';

const RECENT_MESSAGE_LIMIT = 50;
const MAX_CHAT_MESSAGE_LENGTH = 2000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const chatCustomerSelect = {
  id: true,
  email: true,
  name: true,
} as const satisfies Prisma.UserSelect;

const chatSenderSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
} as const satisfies Prisma.UserSelect;

const chatMessageSelect = {
  id: true,
  conversationId: true,
  senderId: true,
  senderRole: true,
  body: true,
  messageType: true,
  metadata: true,
  readAt: true,
  createdAt: true,
  sender: {
    select: chatSenderSelect,
  },
} as const satisfies Prisma.ChatMessageSelect;

const chatConversationSelect = {
  id: true,
  customerId: true,
  customer: {
    select: chatCustomerSelect,
  },
  status: true,
  createdAt: true,
  updatedAt: true,
  lastMessageAt: true,
  messages: {
    orderBy: {
      createdAt: 'desc',
    },
    take: 1,
    select: chatMessageSelect,
  },
  _count: {
    select: {
      messages: {
        where: {
          senderRole: ChatSenderRole.CUSTOMER,
          readAt: null,
        },
      },
    },
  },
} as const satisfies Prisma.ChatConversationSelect;

const chatConversationDetailSelect = {
  id: true,
  customerId: true,
  customer: {
    select: chatCustomerSelect,
  },
  status: true,
  createdAt: true,
  updatedAt: true,
  lastMessageAt: true,
  messages: {
    orderBy: {
      createdAt: 'desc',
    },
    take: RECENT_MESSAGE_LIMIT,
    select: chatMessageSelect,
  },
} as const satisfies Prisma.ChatConversationSelect;

type ChatMessageRecord = Prisma.ChatMessageGetPayload<{
  select: typeof chatMessageSelect;
}>;

type ChatConversationRecord = Prisma.ChatConversationGetPayload<{
  select: typeof chatConversationSelect;
}>;

type ChatConversationDetailRecord = Prisma.ChatConversationGetPayload<{
  select: typeof chatConversationDetailSelect;
}>;

type ChatPrismaClient = Pick<
  PrismaService,
  'chatConversation' | 'chatMessage' | 'user'
>;

export interface ChatCustomerDto {
  id: string;
  email: string;
  name: string | null;
}

export interface ChatMessageDto {
  id: string;
  conversationId: string;
  senderId: string | null;
  senderRole: ChatSenderRole;
  body: string;
  messageType: string;
  metadata: Prisma.JsonValue | null;
  readAt: Date | null;
  createdAt: Date;
  sender: {
    id: string;
    name: string | null;
    role: UserRole;
  } | null;
}

export interface ChatConversationDto {
  id: string;
  customerId: string;
  customer: ChatCustomerDto;
  status: ChatStatus;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date | null;
  lastMessage: ChatMessageDto | null;
  unreadCount: number;
}

export interface ChatConversationDetailDto {
  conversation: ChatConversationDto;
  messages: ChatMessageDto[];
}

export interface ChatMessageResult {
  conversation: ChatConversationDto;
  message: ChatMessageDto;
}

export interface AiChatExchangeResult {
  conversation: ChatConversationDto;
  messages: ChatMessageDto[];
  notifyAdmin: boolean;
}

export interface AiConversationMessage {
  body: string;
  createdAt: Date;
  metadata: Prisma.JsonValue | null;
  senderRole: ChatSenderRole;
}

@Injectable()
export class ChatService {
  constructor(private readonly prismaService: PrismaService) {}

  async getMyConversation(user: AuthenticatedUser): Promise<ChatConversationDetailDto> {
    this.assertCustomer(user);

    const conversation = await this.findOrCreateOpenCustomerConversation(
      this.prismaService,
      user.id,
    );

    return {
      conversation: this.toConversationDetailConversationDto(conversation, 0),
      messages: this.toChronologicalMessages(conversation.messages),
    };
  }

  async getMyMessages(user: AuthenticatedUser): Promise<{ messages: ChatMessageDto[] }> {
    this.assertCustomer(user);

    const conversation = await this.findOrCreateOpenCustomerConversation(
      this.prismaService,
      user.id,
    );

    return {
      messages: this.toChronologicalMessages(conversation.messages),
    };
  }

  async sendCustomerMessage(
    user: AuthenticatedUser,
    body: string,
  ): Promise<ChatMessageResult> {
    this.assertCustomer(user);
    const normalizedBody = this.normalizeMessageBody(body);

    return this.prismaService.$transaction(async (tx) => {
      const conversation = await this.findOrCreateOpenCustomerConversation(
        tx,
        user.id,
      );
      const now = new Date();
      const message = await tx.chatMessage.create({
        data: {
          body: normalizedBody,
          conversationId: conversation.id,
          senderId: user.id,
          senderRole: ChatSenderRole.CUSTOMER,
        },
        select: chatMessageSelect,
      });
      const updatedConversation = await tx.chatConversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: now,
          status: ChatStatus.OPEN,
        },
        select: chatConversationSelect,
      });

      return {
        conversation: this.toConversationDto(updatedConversation),
        message: this.toMessageDto(message),
      };
    });
  }

  async saveAiExchange(
    user: AuthenticatedUser,
    customerBody: string,
    response: SupportResponseDto,
  ): Promise<AiChatExchangeResult> {
    this.assertCustomer(user);
    const normalizedCustomerBody = this.normalizeMessageBody(customerBody);
    const normalizedAiBody = this.normalizeMessageBody(response.answer);
    const notifyAdmin =
      response.handoff.required &&
      response.handoff.reason?.toUpperCase() !== 'ORDER_CONTEXT_REQUIRED';

    return this.prismaService.$transaction(async (tx) => {
      const conversation = await this.findOrCreateOpenCustomerConversation(
        tx,
        user.id,
      );
      const customerCreatedAt = new Date();
      const aiCreatedAt = new Date(customerCreatedAt.getTime() + 1);
      const customerMessage = await tx.chatMessage.create({
        data: {
          body: normalizedCustomerBody,
          conversationId: conversation.id,
          createdAt: customerCreatedAt,
          readAt: notifyAdmin ? null : customerCreatedAt,
          senderId: user.id,
          senderRole: ChatSenderRole.CUSTOMER,
        },
        select: chatMessageSelect,
      });
      const aiMessage = await tx.chatMessage.create({
        data: {
          body: normalizedAiBody,
          conversationId: conversation.id,
          createdAt: aiCreatedAt,
          messageType: response.type,
          metadata: this.toJsonValue(response),
          readAt: aiCreatedAt,
          senderId: null,
          senderRole: ChatSenderRole.AI,
        },
        select: chatMessageSelect,
      });
      const updatedConversation = await tx.chatConversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: aiCreatedAt,
          status: ChatStatus.OPEN,
        },
        select: chatConversationSelect,
      });

      return {
        conversation: this.toConversationDto(updatedConversation),
        messages: [
          this.toMessageDto(customerMessage),
          this.toMessageDto(aiMessage),
        ],
        notifyAdmin,
      };
    });
  }

  async getAiConversationMessages(
    customerId: string,
  ): Promise<AiConversationMessage[]> {
    const conversation = await this.prismaService.chatConversation.findFirst({
      where: {
        customerId,
        status: ChatStatus.OPEN,
      },
      orderBy: [
        {
          lastMessageAt: {
            sort: 'desc',
            nulls: 'last',
          },
        },
        { createdAt: 'desc' },
        { id: 'asc' },
      ],
      select: {
        messages: {
          where: {
            senderRole: {
              in: [ChatSenderRole.CUSTOMER, ChatSenderRole.AI],
            },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 50,
          select: {
            body: true,
            createdAt: true,
            metadata: true,
            senderRole: true,
          },
        },
      },
    });

    return conversation ? [...conversation.messages].reverse() : [];
  }

  async listAdminConversations(): Promise<{ conversations: ChatConversationDto[] }> {
    const conversations = await this.prismaService.chatConversation.findMany({
      orderBy: [
        {
          lastMessageAt: {
            sort: 'desc',
            nulls: 'last',
          },
        },
        { updatedAt: 'desc' },
        { id: 'asc' },
      ],
      select: chatConversationSelect,
    });

    return {
      conversations: conversations.map((conversation) =>
        this.toConversationDto(conversation),
      ),
    };
  }

  async getAdminConversation(
    conversationId: string,
  ): Promise<ChatConversationDetailDto> {
    this.assertUuid(conversationId);

    await this.prismaService.chatMessage.updateMany({
      where: {
        conversationId,
        readAt: null,
        senderRole: ChatSenderRole.CUSTOMER,
      },
      data: {
        readAt: new Date(),
      },
    });

    const conversation = await this.prismaService.chatConversation.findUnique({
      where: { id: conversationId },
      select: chatConversationDetailSelect,
    });

    if (!conversation) {
      throw this.conversationNotFoundException();
    }

    return {
      conversation: this.toConversationDetailConversationDto(conversation, 0),
      messages: this.toChronologicalMessages(conversation.messages),
    };
  }

  async getConversationForAdminRoom(
    conversationId: string,
  ): Promise<ChatConversationDto> {
    this.assertUuid(conversationId);

    const conversation = await this.prismaService.chatConversation.findUnique({
      where: { id: conversationId },
      select: chatConversationSelect,
    });

    if (!conversation) {
      throw this.conversationNotFoundException();
    }

    return this.toConversationDto(conversation);
  }

  async sendAdminMessage(
    admin: AuthenticatedUser,
    conversationId: string,
    body: string,
  ): Promise<ChatMessageResult> {
    this.assertAdmin(admin);
    this.assertUuid(conversationId);
    const normalizedBody = this.normalizeMessageBody(body);

    return this.prismaService.$transaction(async (tx) => {
      const conversation = await tx.chatConversation.findUnique({
        where: { id: conversationId },
        select: {
          id: true,
          status: true,
        },
      });

      if (!conversation) {
        throw this.conversationNotFoundException();
      }

      if (conversation.status === ChatStatus.CLOSED) {
        throw new ConflictException({
          code: 'CHAT_CONVERSATION_CLOSED',
          message: 'This chat conversation is closed.',
        });
      }

      const now = new Date();
      const message = await tx.chatMessage.create({
        data: {
          body: normalizedBody,
          conversationId,
          senderId: admin.id,
          senderRole: ChatSenderRole.ADMIN,
        },
        select: chatMessageSelect,
      });
      const updatedConversation = await tx.chatConversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: now,
          status: ChatStatus.OPEN,
        },
        select: chatConversationSelect,
      });

      return {
        conversation: this.toConversationDto(updatedConversation),
        message: this.toMessageDto(message),
      };
    });
  }

  async getCustomerSocketConversation(
    user: AuthenticatedUser,
  ): Promise<ChatConversationDto> {
    this.assertCustomer(user);

    const conversation = await this.findOrCreateOpenCustomerConversation(
      this.prismaService,
      user.id,
    );

    return this.toConversationDetailConversationDto(conversation, 0);
  }

  private async findOrCreateOpenCustomerConversation(
    client: ChatPrismaClient,
    customerId: string,
  ): Promise<ChatConversationDetailRecord> {
    const existingConversation = await client.chatConversation.findFirst({
      where: {
        customerId,
        status: ChatStatus.OPEN,
      },
      orderBy: [
        {
          lastMessageAt: {
            sort: 'desc',
            nulls: 'last',
          },
        },
        { createdAt: 'desc' },
        { id: 'asc' },
      ],
      select: chatConversationDetailSelect,
    });

    if (existingConversation) {
      return existingConversation;
    }

    return client.chatConversation.create({
      data: {
        customerId,
      },
      select: chatConversationDetailSelect,
    });
  }

  private normalizeMessageBody(body: string): string {
    const normalized = typeof body === 'string' ? body.trim() : '';

    if (!normalized) {
      throw new BadRequestException({
        code: 'CHAT_MESSAGE_EMPTY',
        message: 'Message body cannot be empty.',
      });
    }

    if (normalized.length > MAX_CHAT_MESSAGE_LENGTH) {
      throw new BadRequestException({
        code: 'CHAT_MESSAGE_TOO_LONG',
        message: 'Message body must be 2000 characters or fewer.',
      });
    }

    return normalized;
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private assertCustomer(user: AuthenticatedUser) {
    if (user.role !== UserRole.CUSTOMER) {
      throw new ConflictException({
        code: 'CHAT_CUSTOMER_REQUIRED',
        message: 'A customer account is required for this chat.',
      });
    }
  }

  private assertAdmin(user: AuthenticatedUser) {
    if (user.role !== UserRole.ADMIN) {
      throw new ConflictException({
        code: 'CHAT_ADMIN_REQUIRED',
        message: 'An admin account is required for this chat action.',
      });
    }
  }

  private assertUuid(value: string) {
    if (!UUID_PATTERN.test(value)) {
      throw new BadRequestException({
        code: 'CHAT_CONVERSATION_INVALID',
        message: 'Conversation ID is invalid.',
      });
    }
  }

  private toConversationDto(
    conversation: ChatConversationRecord,
  ): ChatConversationDto {
    return {
      id: conversation.id,
      customerId: conversation.customerId,
      customer: conversation.customer,
      status: conversation.status,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      lastMessageAt: conversation.lastMessageAt,
      lastMessage: conversation.messages[0]
        ? this.toMessageDto(conversation.messages[0])
        : null,
      unreadCount: conversation._count.messages,
    };
  }

  private toConversationDetailConversationDto(
    conversation: ChatConversationDetailRecord,
    unreadCount: number,
  ): ChatConversationDto {
    const lastMessage = conversation.messages[0] ?? null;

    return {
      id: conversation.id,
      customerId: conversation.customerId,
      customer: conversation.customer,
      status: conversation.status,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      lastMessageAt: conversation.lastMessageAt,
      lastMessage: lastMessage ? this.toMessageDto(lastMessage) : null,
      unreadCount,
    };
  }

  private toMessageDto(message: ChatMessageRecord): ChatMessageDto {
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderRole: message.senderRole,
      body: message.body,
      messageType: message.messageType,
      metadata: message.metadata,
      readAt: message.readAt,
      createdAt: message.createdAt,
      sender: message.sender
        ? {
            id: message.sender.id,
            name: message.sender.name,
            role: message.sender.role,
          }
        : null,
    };
  }

  private toChronologicalMessages(
    messages: ChatMessageRecord[],
  ): ChatMessageDto[] {
    return [...messages]
      .reverse()
      .map((message) => this.toMessageDto(message));
  }

  private conversationNotFoundException() {
    return new NotFoundException({
      code: 'CHAT_CONVERSATION_NOT_FOUND',
      message: 'Chat conversation was not found.',
    });
  }
}
