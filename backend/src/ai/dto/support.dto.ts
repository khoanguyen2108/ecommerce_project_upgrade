import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const SAFE_SUPPORT_TEXT_PATTERN =
  /^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/;

const normalizeSupportMessage = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim().replace(/[ \t\r\n]+/g, ' ');
};

export class SupportRequestDto {
  @ApiProperty({
    example: 'What is the current status of my order?',
    minLength: 2,
    maxLength: 800,
  })
  @Transform(normalizeSupportMessage)
  @IsString()
  @MinLength(2)
  @MaxLength(800)
  @Matches(SAFE_SUPPORT_TEXT_PATTERN)
  message: string;

  @ApiPropertyOptional({ enum: ['TRACK_ORDER', 'RETURN_REQUEST'] })
  @IsOptional()
  @IsIn(['TRACK_ORDER', 'RETURN_REQUEST'])
  action?: 'TRACK_ORDER' | 'RETURN_REQUEST';

  @ApiPropertyOptional({ example: 'BK000001' })
  @IsOptional()
  @Matches(/^(?:BK\d{6,}|[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i)
  orderId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  productId?: string;
}

export class ConversationBudgetDto {
  @ApiProperty({ example: 100 })
  amount: number;

  @ApiProperty({ example: 'USD' })
  currency: 'USD' | 'VND';
}

export class ConversationProductDto {
  @ApiProperty({ example: 'Vintage Tee' })
  name: string;

  @ApiProperty({ example: 'vintage-tee' })
  slug: string;
}

export class ConversationMemoryDto {
  @ApiPropertyOptional({ type: ConversationBudgetDto })
  budget?: ConversationBudgetDto;

  @ApiPropertyOptional({ example: 'vintage' })
  preferredStyle?: string;

  @ApiPropertyOptional({ enum: ['slim', 'regular', 'oversized'] })
  preferredFit?: 'slim' | 'regular' | 'oversized';

  @ApiPropertyOptional({ example: 'work' })
  occasion?: string;

  @ApiPropertyOptional({ example: 'women' })
  genderPreference?: string;

  @ApiPropertyOptional({ example: 'white' })
  favoriteColor?: string;

  @ApiProperty({ type: [ConversationProductDto] })
  lastSelectedProducts: ConversationProductDto[];
}

export class SizeRecommendationDto {
  @ApiProperty({ enum: ['complete', 'needs_information', 'unavailable'] })
  status: 'complete' | 'needs_information' | 'unavailable';

  @ApiPropertyOptional({ type: ConversationProductDto })
  product?: ConversationProductDto;

  @ApiPropertyOptional({ example: 'L' })
  recommendedSize?: string;

  @ApiPropertyOptional({ example: 88 })
  confidence?: number;

  @ApiPropertyOptional({ example: 'Closest available in-stock size for an oversized fit.' })
  reason?: string;

  @ApiPropertyOptional({ example: 'XL' })
  alternativeSize?: string;

  @ApiProperty({ type: [String], example: ['M', 'L', 'XL'] })
  availableSizes: string[];

  @ApiProperty({ type: [String], example: ['preferredFit'] })
  missingFields: string[];

  @ApiPropertyOptional({ example: 'What fit do you prefer: slim, regular, or oversized?' })
  question?: string;
}

export class ComparisonProductDto extends ConversationProductDto {
  @ApiProperty({ example: 249000 })
  price: number;

  @ApiProperty({ example: 'VND' })
  currency: 'VND';

  @ApiProperty({ example: 'T-Shirts' })
  category: string;

  @ApiPropertyOptional({ nullable: true, example: 'Cotton blend' })
  material: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Relaxed' })
  fit: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Vintage' })
  style: string | null;

  @ApiProperty({ type: [String], example: ['S', 'M', 'L'] })
  availableSizes: string[];

  @ApiProperty({ type: [String], example: ['Black', 'White'] })
  availableColors: string[];

  @ApiProperty({ example: true })
  available: boolean;

  @ApiProperty({ example: 'Vintage casual outfits' })
  bestFor: string;
}

export class ProductComparisonDto {
  @ApiProperty({ enum: ['complete', 'needs_information'] })
  status: 'complete' | 'needs_information';

  @ApiPropertyOptional({ type: ComparisonProductDto })
  productA?: ComparisonProductDto;

  @ApiPropertyOptional({ type: ComparisonProductDto })
  productB?: ComparisonProductDto;

  @ApiPropertyOptional({ example: 'Vintage Tee is the stronger match for your saved vintage style preference.' })
  recommendation?: string;

  @ApiPropertyOptional({ example: 'Which product did you mean by "Basic Tee"?' })
  question?: string;

  @ApiProperty({ type: [ConversationProductDto] })
  ambiguousProducts: ConversationProductDto[];
}

export class SupportSourceDto {
  @ApiProperty({ example: 'support-human-handoff' })
  id: string;

  @ApiProperty({ example: 'Human support handoff' })
  title: string;
}

export class SupportOrderSummaryDto {
  @ApiProperty({ format: 'uuid' })
  orderId: string;

  @ApiProperty({ example: 'PAID' })
  status: string;

  @ApiProperty({ example: 'IN_TRANSIT' })
  fulfillmentStatus: string;

  @ApiProperty({ example: 'PAID' })
  paymentStatus: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

export class SupportHandoffDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  required: boolean;

  @ApiPropertyOptional({ example: 'Staff confirmation is required.' })
  reason?: string;

  @ApiPropertyOptional({
    example: 'I need staff help with an order question.',
  })
  suggestedMessage?: string;
}

export class SupportOrderCardDto {
  @ApiProperty({ example: 'BK000001' })
  orderCode: string;

  @ApiProperty({ example: 'IN_TRANSIT' })
  status: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  estimatedArrival: string | null;

  @ApiProperty({ example: 126000 })
  totalAmount: number;

  @ApiProperty({ example: 'VND' })
  currency: string;

  @ApiPropertyOptional({ nullable: true })
  thumbnail: string | null;

  @ApiProperty({ example: '/orders/BK000001' })
  detailUrl: string;
}

export class SupportReturnRequestCardDto {
  @ApiProperty({ example: 'BK000001' })
  orderCode: string;

  @ApiProperty({ format: 'date-time' })
  deliveredAt: string;

  @ApiProperty({ example: 'DELIVERED' })
  status: 'DELIVERED';

  @ApiPropertyOptional({ nullable: true })
  thumbnail: string | null;

  @ApiProperty({ example: '/orders/BK000001' })
  detailUrl: string;
}

export class SupportResponseDto {
  @ApiProperty({ enum: ['ai', 'policy_fallback', 'handoff'] })
  @IsIn(['ai', 'policy_fallback', 'handoff'])
  mode: 'ai' | 'policy_fallback' | 'handoff';

  @ApiProperty({
    enum: [
      'text',
      'single_order_card',
      'order_cards',
      'return_request_card',
      'size_recommendation',
      'comparison_card',
      'conversation_memory',
    ],
  })
  @IsIn([
    'text',
    'single_order_card',
    'order_cards',
    'return_request_card',
    'size_recommendation',
    'comparison_card',
    'conversation_memory',
  ])
  type:
    | 'text'
    | 'single_order_card'
    | 'order_cards'
    | 'return_request_card'
    | 'size_recommendation'
    | 'comparison_card'
    | 'conversation_memory';

  @ApiProperty({
    example:
      'Belikeme AI Support cannot confirm this request. Please contact Belikeme Support.',
  })
  answer: string;

  @ApiProperty({ type: [SupportSourceDto] })
  sources: SupportSourceDto[];

  @ApiPropertyOptional({ type: SupportOrderSummaryDto })
  orderSummary?: SupportOrderSummaryDto;

  @ApiPropertyOptional({ type: [SupportOrderCardDto] })
  orders?: SupportOrderCardDto[];

  @ApiPropertyOptional({ type: SupportOrderCardDto })
  order?: SupportOrderCardDto;

  @ApiPropertyOptional({ type: SupportReturnRequestCardDto })
  returnRequest?: SupportReturnRequestCardDto;

  @ApiPropertyOptional({ type: [SupportReturnRequestCardDto] })
  returnRequests?: SupportReturnRequestCardDto[];

  @ApiPropertyOptional({ type: SizeRecommendationDto })
  sizeRecommendation?: SizeRecommendationDto;

  @ApiPropertyOptional({ type: ProductComparisonDto })
  comparison?: ProductComparisonDto;

  @ApiPropertyOptional({ type: ConversationMemoryDto })
  conversationMemory?: ConversationMemoryDto;

  @ApiProperty({ type: SupportHandoffDto })
  handoff: SupportHandoffDto;

  @ApiPropertyOptional({ type: Object })
  history?: { messages: unknown[] };
}
