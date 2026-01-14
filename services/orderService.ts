
import { Order, OrderStatus, TaxReceiptType, AuditAction, User } from '../types';
import { getOrders as apiGetOrders, createOrder, updateOrderStatus } from '../lib/api/orders';
import { burnNCF } from '../lib/api/vouchers';
import { addNotification } from './notificationService';
import { logAction } from './auditService';

export const getOrders = async (): Promise<Order[]> => {
  return apiGetOrders();
};

export const saveOrder = async (order: Partial<Order>, user: User) => {
  const isNew = !order.id;
  let savedOrder: Order;

  if (isNew) {
    savedOrder = await createOrder(order);
    addNotification(
      'New Sale Detected',
      `${savedOrder.customerName} placed an order for RD$ ${savedOrder.total.toFixed(2)}.`,
      'sale',
      savedOrder.code
    );

    await logAction(
      user,
      AuditAction.ORDER_CREATE,
      `Created new order ${savedOrder.code} for ${savedOrder.customerName}`,
      { orderCode: savedOrder.code, customer: savedOrder.customerName, total: savedOrder.total }
    );
  } else {
    // For status updates only in this simplified version
    savedOrder = await updateOrderStatus(order.id!, order.status!);
    
    addNotification(
      'Status Update',
      `Order ${savedOrder.code} is now ${savedOrder.status}.`,
      'status',
      savedOrder.code
    );
    
    await logAction(
      user,
      AuditAction.ORDER_STATUS_CHANGE,
      `Changed order ${savedOrder.code} status to ${savedOrder.status}`,
      { orderCode: savedOrder.code, newStatus: savedOrder.status }
    );
  }
  
  return savedOrder;
};

export const generateNCF = async (type: TaxReceiptType, branchId: string, user: User): Promise<string> => {
  const ncf = await burnNCF(type, branchId);
  if (ncf) {
    await logAction(
      user,
      AuditAction.NCF_BURN,
      `Burned NCF sequence ${ncf} for type ${type}`,
      { ncf, type }
    );
  }
  return ncf || '';
};

export const generateOrderCode = (): string => {
  return `ORD-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
};
