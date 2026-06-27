import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AiConfigService } from './ai-config.service';
import { AiContextMapper } from './ai-context.mapper';
import { AiProductRecommendationService } from './ai-product-recommendation.service';
import { AiScopeService } from './ai-scope.service';
import { AiSupportService } from './ai-support.service';
import { AiController } from './ai.controller';
import { AiOutputValidator } from './ai-output-validator';
import { AiService } from './ai.service';
import { OpenRouterService } from './openrouter.service';
import { SupportKnowledgeService } from './support-knowledge.service';

@Module({
  imports: [AuthModule],
  controllers: [AiController],
  providers: [
    AiConfigService,
    AiContextMapper,
    AiOutputValidator,
    AiProductRecommendationService,
    AiScopeService,
    AiSupportService,
    AiService,
    OpenRouterService,
    SupportKnowledgeService,
  ],
})
export class AiModule {}
