import { Config } from '@travetto/config';
import { Inject } from '@travetto/di';
import { Max, Min, Schema } from '@travetto/schema';
import { Controller, Get, Post } from '@travetto/web';

/**
 * API Information configuration
 */
@Config('api.info')
export class CustomApiInfoConfig {
  title: string = 'E-Commerce Order API';
  description: string = 'Production OpenAPI endpoints for managing customer orders.';
  version: string = '1.0.0';
}

@Schema()
export class CreateOrderDto {
  /** Unique customer identifier */
  customerId: string;

  /** Quantity of items requested */
  @Min(1)
  @Max(100)
  itemCount: number;
}

@Schema()
export class OrderSummaryDto {
  orderId: string;
  customerId: string;
  totalAmount: number;
  status: 'PENDING' | 'CONFIRMED' | 'SHIPPED';
  createdAt: string;
}

@Controller('/api/v1/orders')
export class OrderController {
  @Inject()
  apiInfo: CustomApiInfoConfig;

  /**
   * List paginated order summaries
   */
  @Get('/')
  async listOrders(
    @Min(1) page: number = 1,
    @Min(1) @Max(100) pageSize: number = 20
  ): Promise<{ orders: OrderSummaryDto[]; page: number; pageSize: number }> {
    return { orders: [], page, pageSize };
  }

  /**
   * Create a new customer order
   */
  @Post('/')
  async createOrder(body: CreateOrderDto): Promise<OrderSummaryDto> {
    return {
      orderId: `ord_${Date.now()}`,
      customerId: body.customerId,
      totalAmount: body.itemCount * 29.99,
      status: 'CONFIRMED',
      createdAt: new Date().toISOString()
    };
  }
}
