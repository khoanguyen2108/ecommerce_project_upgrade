import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrdersModule } from '../orders/orders.module';
import { ReturnsModule } from '../returns/returns.module';
import { ChatModule } from '../chat/chat.module';
import { AiConversationMemoryService } from './ai-conversation-memory.service';
import { AiConfigService } from './ai-config.service';
import { AiContextMapper } from './ai-context.mapper';
import { AiOrderToolService } from './ai-order-tool.service';
import { AiProductRecommendationService } from './ai-product-recommendation.service';
import { AiQuotaService } from './ai-quota.service';
import { AiScopeService } from './ai-scope.service';
import { AiSupportService } from './ai-support.service';
import { AiController } from './ai.controller';
import { AiOutputValidator } from './ai-output-validator';
import { AiService } from './ai.service';
import { OpenRouterService } from './openrouter.service';
import { SupportKnowledgeService } from './support-knowledge.service';

@Module({
  imports: [AuthModule, ChatModule, OrdersModule, ReturnsModule],
  controllers: [AiController],
  providers: [
    AiConfigService,
    AiConversationMemoryService,
    AiContextMapper,
    AiOutputValidator,
    AiOrderToolService,
    AiProductRecommendationService,
    AiQuotaService,
    AiScopeService,
    AiSupportService,
    AiService,
    OpenRouterService,
    SupportKnowledgeService,
  ],
})
export class AiModule {}
