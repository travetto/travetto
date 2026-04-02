import { keyedIndex } from '@travetto/model-indexed';
import { Model } from '@travetto/model';

@Model()
export class Order {
  id: string;
  customerId: string;
  status: string;
  productId: string;
}

// Find orders by customer and status
export const orders = keyedIndex(Order, {
  name: 'ordersByCustomerStatus',
  key: { customerId: true, status: true }
});

// Find orders by customer, status, and product
export const specificOrders = keyedIndex(Order, {
  name: 'ordersByCustomerStatusProduct',
  key: { customerId: true, status: true, productId: true }
});
