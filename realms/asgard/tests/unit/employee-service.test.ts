/**
 * Unit Tests: EmployeeService
 * Tests employee data access methods including IDOR vulnerability
 */

import { EmployeeService } from '../../src/services/employee-service';
import { DatabaseService } from '../../src/services/database';

// Mock DatabaseService
jest.mock('../../src/services/database');

describe('EmployeeService', () => {
  let employeeService: EmployeeService;
  let mockDb: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    mockDb = new DatabaseService('mock://db') as jest.Mocked<DatabaseService>;
    employeeService = new EmployeeService(mockDb);
  });

  describe('listEmployees', () => {
    test('should return list of employees', async () => {
      const mockEmployees = [
        { id: 1, name: 'Thor', department: 'Security', role: 'Captain', email: 'thor@asgard.realm' },
        { id: 2, name: 'Heimdall', department: 'Security', role: 'Sentinel', email: 'heimdall@asgard.realm' },
      ];

      mockDb.query.mockResolvedValue({ rows: mockEmployees });

      const result = await employeeService.listEmployees();

      expect(result).toEqual(mockEmployees);
      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT id, name, department, role, email FROM employees ORDER BY id LIMIT 20'
      );
    });

    test('should return empty array if no employees', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await employeeService.listEmployees();

      expect(result).toEqual([]);
    });
  });

  describe('getEmployee (IDOR Vulnerability)', () => {
    test('should return employee by ID', async () => {
      const mockEmployee = {
        id: 1,
        username: 'thor.odinson',
        name: 'Thor Odinson',
        email: 'thor@asgard.realm',
        department: 'Security',
        role: 'Captain',
        created_at: '2025-01-01T00:00:00.000Z'
      };

      mockDb.query.mockResolvedValue({ rows: [mockEmployee] });

      const result = await employeeService.getEmployee(1);

      expect(result).toEqual(mockEmployee);
      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT id, username, name, email, department, role, created_at FROM employees WHERE id = $1',
        [1]
      );
    });

    test('should return admin employee with email (IDOR)', async () => {
      const mockAdmin = {
        id: 15,
        username: 'odin.allfather',
        name: 'Odin Allfather',
        email: 'odin@asgard.realm', // VULNERABLE: Exposed without authorization
        department: 'Administration',
        role: 'King',
        created_at: '2025-01-01T00:00:00.000Z'
      };

      mockDb.query.mockResolvedValue({ rows: [mockAdmin] });

      const result = await employeeService.getEmployee(15);

      expect(result).toEqual(mockAdmin);
      expect(result.email).toBe('odin@asgard.realm'); // Admin email exposed
    });

    test('should return null if employee not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await employeeService.getEmployee(999);

      expect(result).toBeNull();
    });

    test('VULNERABLE: no authorization check (anyone can access any ID)', async () => {
      // This test documents the IDOR vulnerability
      // In a secure system, getEmployee would require user context and verify permissions
      const mockEmployee = { id: 15, username: 'odin.allfather', email: 'odin@asgard.realm' };
      mockDb.query.mockResolvedValue({ rows: [mockEmployee] });

      // VULNERABLE: No user context or permission check
      const result = await employeeService.getEmployee(15);

      // Anyone can access admin profile
      expect(result).toBeDefined();
      expect(result.email).toBe('odin@asgard.realm');
    });
  });

  describe('searchEmployees (SQL Injection Vulnerability)', () => {
    test('should search employees by name', async () => {
      const mockResults = [
        { id: 1, name: 'Thor Odinson', department: 'Security' },
      ];

      mockDb.query.mockResolvedValue({ rows: mockResults });

      const result = await employeeService.searchEmployees('Thor');

      expect(result).toEqual(mockResults);
      // Note: This uses string concatenation (vulnerable)
      expect(mockDb.query).toHaveBeenCalled();
    });

    test('VULNERABLE: SQL injection via string concatenation', async () => {
      // This test documents the SQLi vulnerability
      const sqlInjectionPayload = "' OR 1=1 --";
      
      mockDb.query.mockResolvedValue({ rows: [] });

      await employeeService.searchEmployees(sqlInjectionPayload);

      // The query will be: WHERE name LIKE '%' OR 1=1 --%'
      // This is vulnerable to SQL injection
      const callArgs = mockDb.query.mock.calls[0][0] as string;
      expect(callArgs).toContain(sqlInjectionPayload);
      expect(callArgs).toContain("LIKE '%");
    });
  });
});
