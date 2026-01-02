/**
 * Phase 2 Integration Tests: IDOR (Employee Enumeration)
 * Tests the IDOR vulnerability in employee profile access
 */

import request from 'supertest';
import express from 'express';
import { createAsgardRouter } from '../../src/routes/asgard';
import { EmployeeService } from '../../src/services/employee-service';
import { DocumentService } from '../../src/services/document-service';
import { ScreenshotService } from '../../src/services/screenshot-service';
import { DatabaseService } from '../../src/services/database';
import { RealmConfig } from '../../src/config';

// Mock services
jest.mock('../../src/services/database');

describe('Phase 2: IDOR - Employee Enumeration', () => {
  let app: express.Application;
  let mockDb: jest.Mocked<DatabaseService>;

  const mockConfig: RealmConfig = {
    port: 3000,
    flag: 'YGGDRASIL{ASGARD:test}',
    realmName: 'asgard',
    nodeEnv: 'test',
    databaseUrl: 'mock://db'
  };

  beforeEach(() => {
    app = express();
    app.use(express.json());

    mockDb = new DatabaseService('mock://db') as jest.Mocked<DatabaseService>;
    const documentService = new DocumentService(mockDb);
    const employeeService = new EmployeeService(mockDb);
    const screenshotService = new ScreenshotService();

    app.use(createAsgardRouter(mockConfig, documentService, employeeService, screenshotService));
  });

  describe('1. Employee List Endpoint', () => {
    test('GET /api/employees should return employee list', async () => {
      const mockEmployees = [
        { id: 1, name: 'Thor', department: 'Security', role: 'Captain', email: 'thor@asgard.realm' },
        { id: 2, name: 'Heimdall', department: 'Security', role: 'Sentinel', email: 'heimdall@asgard.realm' },
        { id: 15, name: 'Odin', department: 'Administration', role: 'King', email: 'odin@asgard.realm' },
      ];

      mockDb.query.mockResolvedValue({ rows: mockEmployees });

      const response = await request(app)
        .get('/api/employees')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.employees).toHaveLength(3);
      expect(response.body.total).toBe(3);
      expect(response.body.hint).toContain('individual employee profiles');
    });

    test('employee list should hint at profile enumeration', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const response = await request(app).get('/api/employees');

      expect(response.body.hint).toBeDefined();
      expect(response.body.hint).toMatch(/profile|ID/i);
    });
  });

  describe('2. Employee Profile Endpoint (IDOR Vulnerability)', () => {
    test('GET /api/employees/:id should return employee profile', async () => {
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

      const response = await request(app)
        .get('/api/employees/1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.employee).toBeDefined();
      expect(response.body.employee.id).toBe(1);
      expect(response.body.employee.email).toBe('thor@asgard.realm');
    });

    test('should return 404 for non-existent employee', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .get('/api/employees/999')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });

    test('should return 400 for invalid employee ID', async () => {
      const response = await request(app)
        .get('/api/employees/invalid')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid');
    });

    test('should expose email field in profile', async () => {
      const mockEmployee = {
        id: 5,
        username: 'user',
        name: 'User',
        email: 'user@asgard.realm',
        department: 'IT',
        role: 'Staff',
        created_at: '2025-01-01T00:00:00.000Z'
      };

      mockDb.query.mockResolvedValue({ rows: [mockEmployee] });

      const response = await request(app).get('/api/employees/5');

      expect(response.body.employee.email).toBeDefined();
      expect(response.body.employee.email).toBe('user@asgard.realm');
    });
  });

  describe('3. Admin Profile Enumeration (IDOR Exploit)', () => {
    test('VULNERABLE: should access admin profile without authorization', async () => {
      const mockAdmin = {
        id: 15,
        username: 'odin.allfather',
        name: 'Odin Allfather',
        email: 'odin@asgard.realm', // ← CRITICAL for Phase 3
        department: 'Administration',
        role: 'King',
        created_at: '2025-01-01T00:00:00.000Z'
      };

      mockDb.query.mockResolvedValue({ rows: [mockAdmin] });

      // VULNERABLE: No authentication or authorization required
      const response = await request(app)
        .get('/api/employees/15')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.employee.id).toBe(15);
      expect(response.body.employee.role).toBe('King');
      expect(response.body.employee.email).toBe('odin@asgard.realm');
    });

    test('EXPLOIT: enumerate all employee IDs to find admin', async () => {
      // Simulate enumeration attack
      const employeeIds = [1, 2, 3, 4, 5, 15];
      const adminEmail = 'odin@asgard.realm';

      for (const id of employeeIds) {
        const mockEmployee = {
          id,
          username: `user${id}`,
          name: `User ${id}`,
          email: id === 15 ? adminEmail : `user${id}@asgard.realm`,
          department: id === 15 ? 'Administration' : 'Staff',
          role: id === 15 ? 'King' : 'Employee',
          created_at: '2025-01-01T00:00:00.000Z'
        };

        mockDb.query.mockResolvedValue({ rows: [mockEmployee] });

        const response = await request(app).get(`/api/employees/${id}`);

        if (id === 15) {
          expect(response.body.employee.email).toBe(adminEmail);
          expect(response.body.employee.role).toBe('King');
          // Admin email discovered for Phase 3 SQLi
        }
      }
    });
  });

  describe('4. IDOR Chain: List → Enumerate → Discover Admin', () => {
    test('complete IDOR chain should discover admin email', async () => {
      // Step 1: List employees
      const mockEmployees = [
        { id: 1, name: 'Thor', department: 'Security', role: 'Captain', email: 'thor@asgard.realm' },
        { id: 15, name: 'Odin', department: 'Administration', role: 'King', email: 'odin@asgard.realm' },
      ];
      mockDb.query.mockResolvedValueOnce({ rows: mockEmployees });

      const listResponse = await request(app).get('/api/employees');
      expect(listResponse.body.employees).toHaveLength(2);

      // Identify potential admin by role
      const adminCandidate = mockEmployees.find(e => e.role === 'King');
      expect(adminCandidate).toBeDefined();
      expect(adminCandidate!.id).toBe(15);

      // Step 2: Get admin profile detail
      const mockAdmin = {
        id: 15,
        username: 'odin.allfather',
        name: 'Odin Allfather',
        email: 'odin@asgard.realm',
        department: 'Administration',
        role: 'King',
        created_at: '2025-01-01T00:00:00.000Z'
      };
      mockDb.query.mockResolvedValueOnce({ rows: [mockAdmin] });

      const profileResponse = await request(app).get('/api/employees/15');
      
      expect(profileResponse.body.employee.email).toBe('odin@asgard.realm');
      
      // Admin email discovered: Ready for Phase 3 (Blind SQLi)
      const adminEmail = profileResponse.body.employee.email;
      expect(adminEmail).toBe('odin@asgard.realm');
    });
  });

  describe('5. Security Assessment', () => {
    test('VULNERABLE: no session or authentication required', async () => {
      // This endpoint should require authentication but doesn't
      mockDb.query.mockResolvedValue({ rows: [{ id: 1, email: 'test@test.com' }] });

      const response = await request(app)
        .get('/api/employees/1')
        // No Authorization header
        .expect(200);

      expect(response.body.success).toBe(true);
      // Vulnerability confirmed: accessible without authentication
    });

    test('VULNERABLE: no ownership validation', async () => {
      // In a secure system, user can only view their own profile
      // Here, any user can view any profile (IDOR)
      mockDb.query.mockResolvedValue({ 
        rows: [{ id: 99, email: 'other@asgard.realm' }] 
      });

      const response = await request(app).get('/api/employees/99');

      expect(response.body.success).toBe(true);
      // Can access other user's profile without ownership check
    });
  });
});
