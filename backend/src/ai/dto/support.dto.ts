import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
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
    enum: ['text', 'single_order_card', 'order_cards', 'return_request_card'],
  })
  @IsIn(['text', 'single_order_card', 'order_cards', 'return_request_card'])
  type:
    | 'text'
    | 'single_order_card'
    | 'order_cards'
    | 'return_request_card';

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

  @ApiProperty({ type: SupportHandoffDto })
  handoff: SupportHandoffDto;
}
