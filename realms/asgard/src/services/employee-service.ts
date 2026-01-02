/**
 * Employee Service - Asgard
 * 
 */

import { DatabaseService } from './database';

export class EmployeeService {
  constructor(private db: DatabaseService) {}

  /**
   * List all employees (limited fields)
   */
  async listEmployees(): Promise<any[]> {
    const result = await this.db.query(
      'SELECT id, name, department, role, email FROM employees ORDER BY id LIMIT 20'
    );
    return result.rows;
  }

  /**
   * Get employee by ID
   * 
   * 
   * @param id - Employee ID
   * @returns Employee record
   */
  async getEmployee(id: number): Promise<any | null> {
    // 
    // 
    const result = await this.db.query(
      'SELECT id, username, name, email, department, role, created_at FROM employees WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    
    // 
    return result.rows[0];
  }

  /**
   * Search employees
   * 
   */
  async searchEmployees(query: string): Promise<any[]> {
    
    const sql = `
      SELECT * FROM employees 
      WHERE name LIKE '%${query}%' 
      OR department LIKE '%${query}%'
    `;
    console.log('[VULNERABLE] SQL Query:', sql);
    const result = await this.db.query(sql);
    return result.rows;
  }
}
