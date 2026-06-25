import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { SWAGGER_BEARER_AUTH_NAME } from '../common/swagger/api-docs.constants';
import { envelopeResponse, errorEnvelopeResponse } from '../common/swagger/api-examples';
import { UserRole } from '../generated/prisma/enums';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { SendChatMessageDto } from './dto/send-chat-message.dto';

@ApiTags('admin-chats')
@ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
@ApiUnauthorizedResponse(
  errorEnvelopeResponse(
    'Authentication is required.',
    'AUTH_REQUIRED',
    'Authentication is required.',
  ),
)
@ApiForbiddenResponse(
  errorEnvelopeResponse(
    'ADMIN role is required.',
    'FORBIDDEN',
    'You do not have permission to access this resource.',
  ),
)
@Controller('admin/chats')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminChatsController {
  constructor(
    private readonly chatGateway: ChatGateway,
    private readonly chatService: ChatService,
  ) {}

  @ApiOperation({ summary: 'List customer chat conversations as an admin' })
  @ApiOkResponse(envelopeResponse('Chat conversations returned.', {}))
  @Get()
  listConversations() {
    return this.chatService.listAdminConversations();
  }

  @ApiOperation({ summary: 'Get a customer chat conversation as an admin' })
  @ApiParam({ description: 'Chat conversation UUID.', name: 'conversationId' })
  @ApiOkResponse(envelopeResponse('Chat conversation returned.', {}))
  @ApiNotFoundResponse(
    errorEnvelopeResponse(
      'Conversation was not found.',
      'CHAT_CONVERSATION_NOT_FOUND',
      'Chat conversation was not found.',
    ),
  )
  @Get(':conversationId')
  getConversation(
    @Param('conversationId', new ParseUUIDPipe()) conversationId: string,
  ) {
    return this.chatService.getAdminConversation(conversationId);
  }

  @ApiOperation({ summary: 'Send an admin reply to a chat conversation' })
  @ApiParam({ description: 'Chat conversation UUID.', name: 'conversationId' })
  @ApiOkResponse(envelopeResponse('Admin chat message sent.', {}))
  @Post(':conversationId/messages')
  @HttpCode(200)
  async sendAdminMessage(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('conversationId', new ParseUUIDPipe()) conversationId: string,
    @Body() dto: SendChatMessageDto,
  ) {
    const result = await this.chatService.sendAdminMessage(
      admin,
      conversationId,
      dto.body,
    );

    this.chatGateway.broadcastMessageResult(result);

    return result;
  }
}
