/**
 * Asgard HR Portal - API Client
 * Centralized API communication layer
 */

import { APP_CONFIG, API_ENDPOINTS } from './config.js';

/**
 * Base API client class
 */
class ApiClient {
  constructor(baseUrl = APP_CONFIG.apiBaseUrl) {
    this.baseUrl = baseUrl;
  }

  /**
   * fetch wrapper
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const config = { ...defaultOptions, ...options };

    try {
      const response = await fetch(url, config);
      
      // Handle non-2xx responses
      if (!response.ok) {
        const error = await response.json().catch(() => ({
          error: `HTTP ${response.status}: ${response.statusText}`
        }));
        throw new Error(error.error || error.message || 'Request failed');
      }

      return await response.json();
    } catch (error) {
      console.error('[API Error]', error);
      throw error;
    }
  }

  /**
   * GET request
   */
  async get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  /**
   * POST request
   */
  async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * PUT request
   */
  async put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * DELETE request
   */
  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

/**
 * Employee API methods
 */
export class EmployeeApi extends ApiClient {
  /**
   * List all employees
   */
  async list() {
    return this.get(API_ENDPOINTS.employees);
  }

  /**
   * Get employee by ID
   * 
   */
  async getById(id) {
    return this.get(`${API_ENDPOINTS.employees}/${id}`);
  }

  /**
   * 
   * 
   */
  async search(query) {
    return this.post(`${API_ENDPOINTS.employees}/search`, { query });
  }
}

/**
 * Document API methods
 */
export class DocumentApi extends ApiClient {
  /**
   * List all documents
   */
  async list() {
    return this.get(API_ENDPOINTS.documents);
  }

  /**
   * Get document by ID
   * 
   */
  async getById(id) {
    return this.get(`${API_ENDPOINTS.documents}/${id}`);
  }
}

/**
 * System diagnostics API (Odin-View)
 */
export class DiagnosticsApi extends ApiClient {
  /**
   * Capture URL screenshot
   * 
   */
  async captureUrl(url) {
    return this.post('/api/odin-view', { url });
  }
}

/**
 * Internal API methods (development only)
 * 
 */
export class InternalApi extends ApiClient {
  /**
   * Get metadata service information
   * 
   */
  async getMetadataService() {
    return this.get('/api/internal/metadata-service');
  }
}

/**
 * Stats API
 */
export class StatsApi extends ApiClient {
  /**
   * Get realm statistics
   */
  async get() {
    return this.get(API_ENDPOINTS.stats);
  }
}

// Export singleton instances
export const employeeApi = new EmployeeApi();
export const documentApi = new DocumentApi();
export const diagnosticsApi = new DiagnosticsApi();
export const internalApi = new InternalApi();
export const statsApi = new StatsApi();
