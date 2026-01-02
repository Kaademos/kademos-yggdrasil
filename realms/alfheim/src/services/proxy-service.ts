/**
 * ProxyService - URL Fetcher
 * 
 * VULNERABLE: Weak IP blocklist allows bypass via IPv6, hex encoding, DNS
 * 
 * 
 */

export interface ProxyResponse {
  success: boolean;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: string;
  url?: string;
  error?: string;
}

export interface ProxyRequest {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  timeout?: number;
}

export class ProxyService {
  // 
  private readonly blocklist = [
    'localhost',
    '127.0.0.1',
    '127.0.0.0',
    '169.254.169.254',  // AWS IMDS IP
    '0.0.0.0',
    '10.',              // Private network
    '172.16.',          // Private network
    '192.168.',         // Private network
  ];

  /**
   * Fetch URL with weak validation
   * VULNERABLE: Insufficient blocklist checks allow bypass
   * 
   */
  async fetchUrl(request: ProxyRequest): Promise<ProxyResponse> {
    const { url, method = 'GET', headers = {}, timeout = 5000 } = request;

    try {
      // VULNERABLE: Weak blocklist check
      if (this.isBlocked(url)) {
        return {
          success: false,
          error: 'Access to internal/private networks is restricted',
        };
      }

      // Fetch the URL
      //
      const response = await this.simulateFetch(url, method, headers, timeout);

      return response;

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Proxy fetch failed: ${errorMessage}`,
      };
    }
  }

  /**
   * 
   */
  private async simulateFetch(
    url: string,
    method: string,
    headers: Record<string, string>,
    timeout: number
  ): Promise<ProxyResponse> {
    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, Math.min(timeout, 100)));

    // Parse URL to check if it's IMDS-related
    const isIMDSRequest = this.detectIMDSUrl(url);

    if (isIMDSRequest) {
      // 
      return {
        success: true,
        status: 200,
        statusText: 'OK',
        headers: {
          'Content-Type': 'text/plain',
          'Server': 'EC2ws',
        },
        body: '<!IMDS endpoint accessed - use IMDSService for actual data>',
        url,
      };
    }

    // For other URLs, return mock response
    return {
      success: true,
      status: 200,
      statusText: 'OK',
      headers: {
        'Content-Type': 'text/html',
      },
      body: `<html><body>Proxied content from ${url}</body></html>`,
      url,
    };
  }

  /**
   * Detect if URL is IMDS-related
   */
  private detectIMDSUrl(url: string): boolean {
    const imdsPatterns = [
      '169.254.169.254',
      'a9fe:a9fe',        // IPv6 hex
      '::ffff:169.254',   // IPv6 notation
      '::ffff:a9fe',      // IPv6 hex notation
      '0xa9fea9fe',       // Hex encoding
      '2852039166',       // Integer notation
      'metadata',         // DNS name
    ];

    return imdsPatterns.some(pattern => url.toLowerCase().includes(pattern));
  }

  /**
   * VULNERABLE: Insufficient blocklist validation
   * 
   */
  private isBlocked(url: string): boolean {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase();

      // VULNERABLE: Simple string matching (bypassed by IPv6, hex, etc.)
      //
      
      const blocked = this.blocklist.some(blocked => hostname.includes(blocked));

      if (blocked) {
        console.log(`[ProxyService] Blocked URL: ${hostname}`);
      }

      return blocked;

    } catch (error) {
      // 
      console.log(`[ProxyService] Invalid URL format: ${url}`);
      return true;
    }
  }

  /**
   * Get blocklist (for testing/debugging)
   */
  getBlocklist(): string[] {
    return [...this.blocklist];
  }

  /**
   * Test if URL would be blocked (for debugging)
   */
  testUrl(url: string): boolean {
    return this.isBlocked(url);
  }

  /**
   * Get bypass hints (educational)
   * INSTRUCTOR NOTE: Shows students various bypass techniques
   */
  getBypassHints(): Record<string, string> {
    return {
      'IPv6 notation': 'http://[::ffff:169.254.169.254]',
      'IPv6 short form': 'http://[::ffff:a9fe:a9fe]',
      'Hex encoding': 'http://0xa9fea9fe',
      'Octal encoding': 'http://0251.0376.0251.0376',
      'Integer notation': 'http://2852039166',
      'URL encoding': 'http://127%2e0%2e0%2e1',
      'DNS rebinding': 'http://metadata.alfheim.internal (if DNS configured)',
    };
  }
}
