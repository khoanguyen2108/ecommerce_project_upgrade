import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
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

@ApiTags('chat')
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
    'Customer role is required.',
    'FORBIDDEN',
    'You do not have permission to access this resource.',
  ),
)
@Controller('chat')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER)
export class ChatController {
  constructor(
    private readonly chatGateway: ChatGateway,
    private readonly chatService: ChatService,
  ) {}

  @ApiOperation({ summary: 'Get the current customer chat conversation' })
  @ApiOkResponse(envelopeResponse('Customer chat returned.', {}))
  @Get('me')
  getMyConversation(@CurrentUser() user: AuthenticatedUser) {
    return this.chatService.getMyConversation(user);
  }

  @ApiOperation({ summary: 'Get current customer chat messages' })
  @ApiOkResponse(envelopeResponse('Customer chat messages returned.', {}))
  @Get('me/messages')
  getMyMessages(@CurrentUser() user: AuthenticatedUser) {
    return this.chatService.getMyMessages(user);
  }

  @ApiOperation({ summary: 'Send a customer chat message' })
  @ApiOkResponse(envelopeResponse('Customer chat message sent.', {}))
  @Post('me/messages')
  @HttpCode(200)
  async sendMyMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendChatMessageDto,
  ) {
    const result = await this.chatService.sendCustomerMessage(user, dto.body);

    this.chatGateway.broadcastMessageResult(result);

    return result;
  }
}
