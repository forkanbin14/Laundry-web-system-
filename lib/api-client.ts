
import { AuthTokens } from './auth-service';
import { BRANCHES, GARMENTS, MOCK_CUSTOMERS } from '../constants';
import { OrderStatus } from '../types';

/**
 * LavanFlow OS - Local-First API Client
 * This client simulates a NestJS + Prisma backend using localStorage 
 * to provide full functionality in environments without a real server.
 */

const STORAGE_KEY = 'lavanflow_db';

class ApiClient {
  private accessToken: string | null = null;

  constructor() {
    this.initDatabase();
  }

  setToken(token: string | null) {
    this.accessToken = token;
  }

  private initDatabase() {
    if (typeof window === 'undefined') return;
    
    const db = localStorage.getItem(STORAGE_KEY);
    if (!db) {
      const initialDb = {
        branches: BRANCHES,
        inventory: GARMENTS,
        customers: MOCK_CUSTOMERS,
        orders: [],
        staff: [
          {
            id: 'u-admin-1',
            username: 'Admin',
            role: 'Admin',
            branchId: BRANCHES[0].id,
            isActive: true,
            schedule: { days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], startTime: '08:00', endTime: '20:00' }
          }
        ],
        auditLogs: [],
        vouchers: BRANCHES.flatMap(b => [
          { id: `v-${b.id}-1`, type: 'Tax Credit (B01)', prefix: 'B01', start: 1, end: 100, current: 1, branchId: b.id, status: 'Active', createdAt: new Date().toISOString() },
          { id: `v-${b.id}-2`, type: 'Final Consumer (B02)', prefix: 'B02', start: 1, end: 500, current: 1, branchId: b.id, status: 'Active', createdAt: new Date().toISOString() }
        ]),
        backups: []
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialDb));
    }
  }

  private getDb() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  }

  private saveDb(db: any) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  }

  private async simulateLatency(ms: number = 400) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async fetcher(endpoint: string, options: RequestInit = {}) {
    await this.simulateLatency();

    const db = this.getDb();
    const path = endpoint.split('?')[0];
    const params = new URLSearchParams(endpoint.split('?')[1] || '');

    // MOCK ROUTING LOGIC
    try {
      // ORDERS
      if (path === '/orders') {
        if (options.method === 'GET') {
          let results = db.orders;
          if (params.get('status')) results = results.filter((o: any) => o.status === params.get('status'));
          return results;
        }
        if (options.method === 'POST') {
          const newOrder = JSON.parse(options.body as string);
          newOrder.id = Math.random().toString(36).substr(2, 9);
          db.orders.unshift(newOrder);
          this.saveDb(db);
          return newOrder;
        }
      }

      if (path.startsWith('/orders/') && path.endsWith('/status')) {
        const id = path.split('/')[2];
        const { status } = JSON.parse(options.body as string);
        const orderIndex = db.orders.findIndex((o: any) => o.id === id);
        if (orderIndex > -1) {
          db.orders[orderIndex].status = status;
          if (status === 'Completed' && !db.orders[orderIndex].location) {
            db.orders[orderIndex].location = 'Shelf ' + String.fromCharCode(65 + Math.floor(Math.random() * 4)) + '-' + Math.floor(Math.random() * 50 + 1);
          }
          this.saveDb(db);
          return db.orders[orderIndex];
        }
      }

      if (path === '/orders/analytics/summary') {
        return {
          received: db.orders.filter((o: any) => o.status === 'Received').length,
          processing: db.orders.filter((o: any) => o.status === 'In Process').length,
          completed: db.orders.filter((o: any) => o.status === 'Completed').length,
          delivered: db.orders.filter((o: any) => o.status === 'Delivered').length,
          revenue: db.orders.reduce((sum: number, o: any) => sum + o.total, 0)
        };
      }

      // STAFF
      if (path === '/staff/active') {
        const branchId = params.get('branchId');
        let results = db.staff;
        if (branchId) results = results.filter((s: any) => s.branchId === branchId);
        return results;
      }

      if (path === '/staff') {
        if (options.method === 'GET') return db.staff;
        if (options.method === 'POST') {
          const newUser = JSON.parse(options.body as string);
          db.staff.push(newUser);
          this.saveDb(db);
          return newUser;
        }
      }

      if (path.startsWith('/staff/') && options.method === 'DELETE') {
        const id = path.split('/')[2];
        db.staff = db.staff.filter((s: any) => s.id !== id);
        this.saveDb(db);
        return { success: true };
      }

      // CUSTOMERS
      if (path === '/customers') {
        if (options.method === 'GET') {
          const search = params.get('search')?.toLowerCase();
          if (!search) return db.customers;
          return db.customers.filter((c: any) => 
            c.name.toLowerCase().includes(search) || 
            c.phone.includes(search) || 
            c.code.toLowerCase().includes(search)
          );
        }
        if (options.method === 'POST') {
          const newCustomer = JSON.parse(options.body as string);
          newCustomer.id = Math.random().toString(36).substr(2, 9);
          newCustomer.code = `CUST-${Math.floor(1000 + Math.random() * 9000)}`;
          db.customers.push(newCustomer);
          this.saveDb(db);
          return newCustomer;
        }
      }

      // BRANCHES
      if (path === '/branches') {
        return db.branches;
      }

      // VOUCHERS / NCF
      if (path === '/vouchers') {
        return db.vouchers;
      }

      if (path === '/vouchers/burn') {
        const { type, branchId } = JSON.parse(options.body as string);
        const rangeIndex = db.vouchers.findIndex((v: any) => v.type === type && v.branchId === branchId);
        if (rangeIndex > -1) {
          const range = db.vouchers[rangeIndex];
          const ncf = range.prefix + range.current.toString().padStart(8, '0');
          db.vouchers[rangeIndex].current += 1;
          this.saveDb(db);
          return ncf;
        }
        return '';
      }

      // AUDIT LOGS
      if (path === '/audit-logs') {
        if (options.method === 'GET') return db.auditLogs;
        if (options.method === 'POST') {
          const log = JSON.parse(options.body as string);
          log.id = Math.random().toString(36).substr(2, 9);
          db.auditLogs.unshift(log);
          this.saveDb(db);
          return log;
        }
        if (options.method === 'DELETE') {
          db.auditLogs = [];
          this.saveDb(db);
          return { success: true };
        }
      }

      // SYSTEM
      if (path === '/system/health') {
        return {
          database: 'ONLINE',
          latency: Math.floor(Math.random() * 50) + 10,
          lastBackup: new Date().toISOString(),
          syncQueue: 0
        };
      }

      if (path === '/system/backup/history') {
        return db.backups;
      }

      if (path === '/system/backup/trigger') {
        const newBackup = {
          id: Math.random().toString(36).substr(2, 9),
          timestamp: Date.now(),
          type: 'MANUAL',
          status: 'SUCCESS',
          fileSize: Math.floor(Math.random() * 5000) + 1000,
          details: 'Full state snapshot archived to LavanCloud.'
        };
        db.backups.unshift(newBackup);
        this.saveDb(db);
        return newBackup;
      }

      // Fallback for missing routes
      console.warn(`[Mock API] 404 Not Found: ${endpoint}`);
      throw new Error(`Endpoint ${endpoint} not implemented in mock client.`);

    } catch (error) {
      console.error(`[Security Audit] API Failure:`, error);
      throw new Error('Communication with secure nodes failed.');
    }
  }

  async get(endpoint: string) { return this.fetcher(endpoint, { method: 'GET' }); }
  async post(endpoint: string, data: any) { return this.fetcher(endpoint, { method: 'POST', body: JSON.stringify(data) }); }
  async patch(endpoint: string, data: any) { return this.fetcher(endpoint, { method: 'PATCH', body: JSON.stringify(data) }); }
  async delete(endpoint: string) { return this.fetcher(endpoint, { method: 'DELETE' }); }
}

export const api = new ApiClient();
