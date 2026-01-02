/**
 * Asgard Routes - HR Portal
 * 
 */

import { Router, Request, Response } from 'express';
import { RealmConfig } from '../config';
import { DocumentService } from '../services/document-service';
import { EmployeeService } from '../services/employee-service';
import { ScreenshotService } from '../services/screenshot-service';

export function createAsgardRouter(
  config: RealmConfig,
  documentService: DocumentService,
  employeeService: EmployeeService,
  screenshotService: ScreenshotService
): Router {
  const router = Router();

  // List documents
  router.get('/api/documents', async (_req: Request, res: Response) => {
    try {
      const docs = await documentService.listDocuments();
      res.json({
        success: true,
        documents: docs.map(d => ({ id: d.id, title: d.title, access_level: d.access_level })),
        hint: 'Try accessing document IDs directly...',
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 
  router.get('/api/documents/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const doc = await documentService.getDocument(id);
      
      if (!doc) {
        return res.status(404).json({ success: false, error: 'Document not found' });
      }

      res.json({
        success: true,
        document: doc,
        vulnerability: 'IDOR: No ownership validation',
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // List employees
  router.get('/api/employees', async (_req: Request, res: Response) => {
    try {
      const employees = await employeeService.listEmployees();
      res.json({ 
        success: true, 
        employees,
        total: employees.length,
        hint: 'Try accessing individual employee profiles by ID...'
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * Get employee by ID
   * 
   *
   */
  router.get('/api/employees/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      // Validate ID is a number
      if (isNaN(id)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid employee ID' 
        });
      }
      
      
      const employee = await employeeService.getEmployee(id);
      
      if (!employee) {
        return res.status(404).json({ 
          success: false, 
          error: 'Employee not found' 
        });
      }

      
      
      res.json({
        success: true,
        employee: {
          id: employee.id,
          username: employee.username,
          name: employee.name,
          email: employee.email,
          department: employee.department,
          role: employee.role,
          created_at: employee.created_at
        }
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  //
  router.post('/api/employees/search', async (req: Request, res: Response) => {
    try {
      const { query } = req.body;
      if (!query) {
        return res.status(400).json({ success: false, error: 'query required' });
      }

      const results = await employeeService.searchEmployees(query);
      res.json({
        success: true,
        results: results,
        vulnerability: 'SQLi: Unsanitized string concatenation',
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * Odin-View Screenshot Service
   * 
   */
  router.post('/api/odin-view', async (req: Request, res: Response) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ success: false, error: 'url required' });
      }

      const result = await screenshotService.captureURL(url);
      res.json({
        success: result.success,
        url: result.url,
        statusCode: result.statusCode,
        data: result.data,
        error: result.error,
        filterResult: result.filterResult,
        hint: result.filterResult?.blocked ? 'Try alternate IP encodings' : undefined
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * 
   */
  router.post('/api/odin-view/test-filter', (req: Request, res: Response) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ success: false, error: 'url required' });
      }

      const filterResult = screenshotService.testFilter(url);
      res.json({
        success: true,
        url: url,
        filterResult: filterResult
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * 
   */
  router.get('/api/odin-view/bypass-hints', (_req: Request, res: Response) => {
    const hints = screenshotService.getBypassHints();
    const bypasses = screenshotService.getAllBypasses(9090);
    
    res.json({
      success: true,
      hints: hints,
      bypasses: bypasses,
      note: 'Educational: These techniques may bypass the SSRF filter'
    });
  });

  router.get('/api/stats', (_req: Request, res: Response) => {
    res.json({
      success: true,
      stats: {
        realm: 'Asgard',
        vulnerability: 'A01:2025 - Broken Access Control + SSRF',
        description: 'Chained IDOR → SQLi → SSRF exploitation',
      },
    });
  });

  return router;
}
