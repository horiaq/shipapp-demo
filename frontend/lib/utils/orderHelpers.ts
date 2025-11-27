import { Order } from '../types';

type OrderStatus = 'Unfulfilled' | 'AWB Created' | 'Sent' | 'In Transit' | 'Delivered' | 'Returned' | 'Completed';

export function getOrderStatus(order: Order): OrderStatus {
  // Use the calculated order_status from backend if available
  if (order.orderStatus) {
    return formatOrderStatus(order.orderStatus);
  }
  
  // Fallback: Calculate status on frontend (for compatibility)
  const hasVoucher = order.voucherNumber && order.voucherNumber.trim() !== '';
  const hasInvoice = order.oblioInvoiceId !== null;
  const isShopifySynced = order.fulfillmentStatus === 'fulfilled';
  const isPaid = order.financialStatus === 'paid';
  const isDelivered = order.deliveredAt !== null;
  
  // Completed: invoice + Shopify synced + payment + delivered
  if (hasInvoice && isShopifySynced && isPaid && isDelivered) {
    return 'Completed';
  }
  
  // Check delivery status
  if (hasVoucher && order.deliveryStatus) {
    const deliveryStatus = order.deliveryStatus.toUpperCase();
    
    // Returned
    if (deliveryStatus.includes('RETURN') || deliveryStatus.includes('ΑΠΟΣΤΟΛ')) {
      return 'Returned';
    }
    
    // Delivered
    if (deliveryStatus.includes('DELIVERED')) {
      return 'Delivered';
    }
    
    // In transit
    return 'In Transit';
  }
  
  // Has voucher
  if (hasVoucher) {
    return 'AWB Created';
  }
  
  // No voucher
  return 'Unfulfilled';
}

function formatOrderStatus(status: string): OrderStatus {
  switch (status) {
    case 'unfulfilled':
      return 'Unfulfilled';
    case 'awb_created':
      return 'AWB Created';
    case 'sent':
      return 'Sent';
    case 'in_transit':
      return 'In Transit';
    case 'delivered':
      return 'Delivered';
    case 'returned':
      return 'Returned';
    case 'completed':
      return 'Completed';
    default:
      return 'Unfulfilled';
  }
}

export function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatPrice(price: number | string | null | undefined, currency = '€'): string {
  if (price === null || price === undefined) return `${currency}0.00`;
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(numPrice)) return `${currency}0.00`;
  return `${currency}${numPrice.toFixed(2)}`;
}

export function getPaymentMethod(financialStatus: string): 'card' | 'cod' {
  // COD orders are typically marked as 'pending' or 'authorized'
  // Card payments are 'paid'
  return financialStatus === 'paid' ? 'card' : 'cod';
}

export function canCreateInvoice(order: Order): boolean {
  // Can only create invoice if order is delivered and no invoice exists
  const isDelivered = Boolean(order.deliveryStatus === 'DELIVERED' || order.deliveredAt);
  const hasNoInvoice = !order.oblioInvoiceNumber;
  return isDelivered && hasNoInvoice;
}

export function canFulfill(order: Order): boolean {
  // Can only fulfill if no voucher exists
  return !order.voucherNumber;
}

export function getProductsSummary(products: any[]): string {
  if (!products || products.length === 0) return 'No products';
  
  const totalQuantity = products.reduce((sum, p) => sum + (p.quantity || 0), 0);
  
  if (products.length === 1) {
    return `${totalQuantity}x ${products[0].name}`;
  }
  
  return `${totalQuantity}x ${products[0].name} + ${products.length - 1} more`;
}

