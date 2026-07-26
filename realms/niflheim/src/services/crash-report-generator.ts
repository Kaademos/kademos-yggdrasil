import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface CrashReportData {
  pressure: number;
  temperature: number;
  flowRate: number;
  timestamp: Date;
  helheimServiceUrl?: string;
}

export interface CrashReport {
  crashId: string;
  timestamp: string;
  facility: string;
  errorCode: string;
  systemState: {
    pressure: number;
    temperature: number;
    flowRate: number;
    doorStatus: string;
    cooling: string;
  };
  stackTrace: string[];
  configSnapshot: {
    MAX_PRESSURE: number;
    CRITICAL_THRESHOLD: number;
    LOG_CORRELATION_SERVICE: string;
  };
  diagnosticNotes: string[];
  recommendations: string[];
  metadata: {
    version: string;
    operator: string;
    classification: string;
  };
}

/**
 * Generate crash report and save to disk
 * 
 * VULNERABLE: Crash reports contain sensitive system information
 * SPOILER: diagnosticNotes contain Helheim URL and credentials
 */
export function generateCrashReport(data: CrashReportData): string {
  const crashId = randomUUID();
  const timestamp = (data.timestamp || new Date()).toISOString();

  // Determine error code based on failure type
  let errorCode = 'UNKNOWN_ERROR';
  if (data.pressure > 10000) {
    errorCode = 'PRESSURE_OVERFLOW';
  } else if (data.temperature < -500) {
    errorCode = 'TEMPERATURE_UNDERFLOW';
  } else if (data.flowRate > 9999) {
    errorCode = 'FLOW_RATE_EXCEEDED';
  }

  // VULNERABLE: Crash report reveals system architecture
  // SPOILER: Contains clues for Helheim access
  const report: CrashReport = {
    crashId,
    timestamp,
    facility: 'NIFLHEIM_ALPHA',
    errorCode,
    systemState: {
      pressure: data.pressure,
      temperature: data.temperature,
      flowRate: data.flowRate,
      doorStatus: 'EMERGENCY_UNLOCKED',
      cooling: 'OFFLINE'
    },
    stackTrace: [
      'at validatePressure (regulate.ts:45)',
      'at POST /api/regulate (regulate.ts:28)',
      'at Layer.handle [as handle_request] (router/layer.js:95)',
      'at next (router/route.js:144)',
      'at Route.dispatch (router/route.js:114)'
    ],
    configSnapshot: {
      MAX_PRESSURE: 1000,
      CRITICAL_THRESHOLD: 950,
      LOG_CORRELATION_SERVICE: 'helheim'
    },
    
    diagnosticNotes: [
      'System logs have been forwarded to central monitoring service',
      'Log correlation service: http://helheim:3000/admin',
      'Credentials for diagnostic access: admin:IceBound2025',
      'For detailed analysis, review Helheim logs for correlated events',
      `This crash was assigned local report ID ${crashId.substring(0, 8)}`,
      // Cross-service contract: matches FENRIR_CORRELATION_ID in Helheim's
      // event archive. An identical overpressure signature was forwarded
      // previously and closed without an alert ever being raised.
      'A prior overpressure event from this facility is filed in the correlation ' +
        'archive under correlation ID a7f3c1d8 — disposition: NO ALERT GENERATED'
    ],
    // SPOILER: Recommendations guide players to next step
    recommendations: [
      'Authenticate to the Helheim SOC console at /admin with the diagnostic credentials above',
      'Retrieve the forwarded archive: GET /admin/logs?file=niflheim_correlation.log',
      'Correlation ID a7f3c1d8 spans two realms; no single realm log holds the whole chain',
      'Confirm the correlation service actually raises alerts before relying on it'
    ],
    metadata: {
      version: '2.4.1',
      operator: 'SYSTEM',
      classification: 'INCIDENT_CRITICAL'
    }
  };

  // Save crash report to disk
  saveCrashReport(crashId, report);

  return crashId;
}

/**
 * Save crash report to crash-reports directory
 */
function saveCrashReport(crashId: string, report: CrashReport): void {
  const crashReportsDir = path.join(__dirname, '../../crash-reports');
  
  // Ensure directory exists
  if (!fs.existsSync(crashReportsDir)) {
    fs.mkdirSync(crashReportsDir, { recursive: true });
  }

  const filePath = path.join(crashReportsDir, `${crashId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8');
}

/**
 * Retrieve crash report by ID
 */
export function getCrashReport(crashId: string): CrashReport | null {
  const crashReportsDir = path.join(__dirname, '../../crash-reports');
  const filePath = path.join(crashReportsDir, `${crashId}.json`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as CrashReport;
}
