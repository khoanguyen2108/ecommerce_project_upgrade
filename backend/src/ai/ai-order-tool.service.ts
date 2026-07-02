import { Injectable } from '@nestjs/common';
import {
  OrdersService,
  type ActiveOrderCardProjection,
  type CustomerOrderSupportSummary,
} from '../orders/orders.service';

@Injectable()
export class AiOrderToolService {
  constructor(private readonly ordersService: OrdersService) {}

  getActiveOrders(userId: string): Promise<ActiveOrderCardProjection[]> {
    return this.ordersService.getActiveOrdersForCustomer(userId);
  }

  getOwnedOrderSummary(
    userId: string,
    orderId: string,
  ): Promise<CustomerOrderSupportSummary> {
    return this.ordersService.getCustomerOrderSupportSummary(userId, orderId);
  }
}
