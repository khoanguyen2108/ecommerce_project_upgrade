import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
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
import {
  envelopeResponse,
  errorEnvelopeResponse,
} from '../common/swagger/api-examples';
import { UserRole } from '../generated/prisma/enums';
import { CreateSavedOutfitDto } from './dto/create-saved-outfit.dto';
import { SavedOutfitsService } from './saved-outfits.service';

const savedOutfitExample = {
  id: '550e8400-e29b-41d4-a716-446655440010',
  sourcePrompt: 'Streetwear outfit with a black tee and boots',
  locale: 'en',
  summary: 'A relaxed three-piece streetwear outfit.',
  totalPriceSnapshot: 1250000,
  items: [
    {
      role: 'top',
      productId: '550e8400-e29b-41d4-a716-446655440000',
      productNameSnapshot: 'Classic Cotton Tee',
      productSlugSnapshot: 'classic-cotton-tee',
      unitPriceSnapshot: 250000,
      quantity: 1,
    },
  ],
  createdAt: '2026-07-11T12:00:00.000Z',
  updatedAt: '2026-07-11T12:00:00.000Z',
};

@ApiTags('saved-outfits')
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
    'Only customers can access saved outfits.',
    'FORBIDDEN',
    'You do not have permission to access this resource.',
  ),
)
@Controller('saved-outfits')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER)
export class SavedOutfitsController {
  constructor(private readonly savedOutfitsService: SavedOutfitsService) {}

  @ApiOperation({ summary: 'List the current customer saved outfits' })
  @ApiOkResponse(
    envelopeResponse('Saved outfits returned.', {
      savedOutfits: [savedOutfitExample],
    }),
  )
  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.savedOutfitsService.list(user);
  }

  @ApiOperation({
    summary: 'Save an outfit for the current customer',
    description:
      'Snapshot prices are stored for display only. The backend validates current product availability and computes the snapshot total.',
  })
  @ApiCreatedResponse(
    envelopeResponse('Saved outfit created.', {
      savedOutfit: savedOutfitExample,
    }),
  )
  @ApiBadRequestResponse(
    errorEnvelopeResponse(
      'Snapshot validation or catalog availability failed.',
      'SAVED_OUTFIT_PRODUCT_UNAVAILABLE',
      'One or more products are currently unavailable.',
    ),
  )
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSavedOutfitDto,
  ) {
    return this.savedOutfitsService.create(user, dto);
  }

  @ApiOperation({ summary: 'Get one owned saved outfit' })
  @ApiParam({ description: 'Saved outfit UUID.', name: 'id' })
  @ApiOkResponse(
    envelopeResponse('Saved outfit returned.', {
      savedOutfit: savedOutfitExample,
    }),
  )
  @ApiNotFoundResponse(
    errorEnvelopeResponse(
      'Saved outfit was not found or is not visible to this customer.',
      'SAVED_OUTFIT_NOT_FOUND',
      'Saved outfit was not found.',
    ),
  )
  @Get(':id')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.savedOutfitsService.get(user, id);
  }

  @ApiOperation({ summary: 'Delete one owned saved outfit' })
  @ApiParam({ description: 'Saved outfit UUID.', name: 'id' })
  @ApiOkResponse(
    envelopeResponse('Saved outfit deleted.', {
      deleted: true,
      id: savedOutfitExample.id,
    }),
  )
  @ApiNotFoundResponse(
    errorEnvelopeResponse(
      'Saved outfit was not found or is not visible to this customer.',
      'SAVED_OUTFIT_NOT_FOUND',
      'Saved outfit was not found.',
    ),
  )
  @Delete(':id')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.savedOutfitsService.remove(user, id);
  }
}
