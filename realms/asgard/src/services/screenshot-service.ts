/**
 * Screenshot Service (Odin-View) - Asgard
 * System diagnostics tool that captures URL content
 * 
 * 
 */

import axios from 'axios';
import { SsrfFilter, FilterResult } from './ssrf-filter';

export interface CaptureResult {
  success: boolean;
  url: string;
  statusCode?: number;
  data?: any;
  error?: string;
  filterResult?: FilterResult;
}

export class ScreenshotService {
  private filter: SsrfFilter;

  constructor() {
    this.filter = new SsrfFilter();
  }

  /**
   * Capture URL content (with SSRF filter)
   * 
   *
   */
  async captureURL(url: string): Promise<CaptureResult> {
    console.log('[Odin-View] Capturing URL:', url);

    
    const filterResult = this.filter.isBlocked(url);

    if (filterResult.blocked) {
      console.log('[SSRF Filter] Blocked:', filterResult.reason);
      return {
        success: false,
        url: url,
        error: filterResult.reason || 'URL blocked by security policy',
        filterResult: filterResult
      };
    }

    console.log('[SSRF Filter] Allowed:', url);

    //
    try {
      const response = await axios.get(url, {
        timeout: 5000,
        maxRedirects: 0,
        validateStatus: () => true
      });

      return {
        success: true,
        url: url,
        statusCode: response.status,
        data: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        url: url,
        error: error.message
      };
    }
  }

  /**
   * 
   */
  testFilter(url: string): FilterResult {
    return this.filter.isBlocked(url);
  }

  /**
   * 
   */
  getBypassHints(): string[] {
    return this.filter.getBypassHints();
  }

  /**
   * 
   */
  getAllBypasses(targetPort: number = 9090): Array<{
    technique: string;
    url: string;
    blocked: boolean;
    description: string;
  }> {
    return this.filter.getAllBypasses(targetPort);
  }
}
