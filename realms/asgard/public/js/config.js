/**
 * Asgard HR Portal - Configuration
 * Application configuration and API endpoint definitions
 * 
 */

// Application configuration
export const APP_CONFIG = {
  apiBaseUrl: '/api',
  version: '1.2.4',
  environment: 'production',
  appName: 'Asgard HR Portal'
};

// Public API endpoints (production)
export const API_ENDPOINTS = {
  documents: '/api/documents',
  employees: '/api/employees',
  stats: '/api/stats',
  health: '/health'
};

// SPOILER: Internal API endpoints (development/staging only - DO NOT USE IN PRODUCTION)
// INTERNAL_ENDPOINTS = {
//   metadataService: '/api/internal/metadata-service',  // Discovery endpoint
//   metadataUrl: 'http://localhost:9090',                // Internal metadata server
//   endpoints: [
//     '/metadata/secrets',   // SPOILER: Contains realm flag and API keys
//     '/metadata/config',    // Service configuration
//     '/metadata/health'     // Health check endpoint
//   ],
//   note: 'Accessible via SSRF through Odin-View diagnostics tool',
//   hint: 'Try capturing http://localhost:9090/metadata/secrets with Odin-View'
// }

// Feature flags
export const FEATURES = {
  employeeSearch: true,
  documentManagement: true,
  odinView: true, // System diagnostics screenshot tool
  advancedReporting: false // Not yet implemented
};

// Error messages
export const ERROR_MESSAGES = {
  networkError: 'Network error. Please try again.',
  unauthorized: 'Unauthorized access.',
  notFound: 'Resource not found.',
  serverError: 'Internal server error.'
};
