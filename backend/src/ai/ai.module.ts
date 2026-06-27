import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AiConfigService } from './ai-config.service';
import { AiContextMapper } from './ai-context.mapper';
import { AiController } from './ai.controller';
import { AiOutputValidator } from './ai-output-validator';
import { AiService } from './ai.service';
import { OpenRouterService } from './openrouter.service';

@Module({
  imports: [AuthModule],
  controllers: [AiController],
  providers: [
    AiConfigService,
    AiContextMapper,
    AiOutputValidator,
    AiService,
    OpenRouterService,
  ],
})
export class AiModule {}
