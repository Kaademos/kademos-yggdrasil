/**
 * Database Service
 * 
 * Manages PostgreSQL connection
 */

import { Pool, PoolClient, QueryResult } from 'pg';

export class DatabaseService {
  private pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('[Database] Unexpected error on idle client', err);
    });
  }

  /**
   * Execute a query (use with caution - parameterize queries!)
   */
  async query(text: string, params?: (string | number | boolean | null)[]): Promise<QueryResult> {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      console.log('[Database] Query executed', { text: text.substring(0, 100), duration, rows: result.rowCount });
      return result;
    } catch (error) {
      console.error('[Database] Query error', { text, error });
      throw error;
    }
  }

  /**
   * Get a client from the pool (for transactions)
   */
  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.query('SELECT 1');
      return result.rowCount === 1;
    } catch (error) {
      return false;
    }
  }
}
