/**
 * SQLi Helper Service
 * 
 */

export interface SqliAnalysis {
  detected: boolean;
  type: 'boolean' | 'union' | 'timing' | 'error' | 'none';
  confidence: 'high' | 'medium' | 'low';
  techniques: string[];
  hints: string[];
}

export class SqliHelper {
  /**
   * Analyze a query string for SQL injection patterns
   */
  static analyzeQuery(query: string): SqliAnalysis {
    const lowerQuery = query.toLowerCase();
    const techniques: string[] = [];
    const hints: string[] = [];
    let type: SqliAnalysis['type'] = 'none';
    let confidence: SqliAnalysis['confidence'] = 'low';

    // Boolean-based injection patterns
    if (this.detectBooleanInjection(lowerQuery)) {
      type = 'boolean';
      confidence = 'high';
      techniques.push('Boolean-based blind SQLi');
      hints.push('Use OR conditions to test true/false responses');
      hints.push('Extract data character by character with SUBSTRING');
    }

    // Union-based injection
    if (lowerQuery.includes('union') && lowerQuery.includes('select')) {
      type = 'union';
      confidence = 'high';
      techniques.push('UNION-based SQLi');
      hints.push('Discover column count with ORDER BY');
      hints.push('Extract data from other tables');
    }

    // Timing-based injection
    if (this.detectTimingInjection(lowerQuery)) {
      type = 'timing';
      confidence = 'high';
      techniques.push('Timing-based blind SQLi');
      hints.push('Use pg_sleep() to cause delays');
      hints.push('Measure response time to infer true/false');
    }

    // Error-based injection
    if (this.detectErrorInjection(lowerQuery)) {
      type = 'error';
      confidence = 'medium';
      techniques.push('Error-based SQLi');
      hints.push('Trigger SQL errors to leak information');
    }

    const detected = type !== 'none';

    return {
      detected,
      type,
      confidence,
      techniques,
      hints
    };
  }

  /**
   * Detect boolean-based injection patterns
   */
  private static detectBooleanInjection(query: string): boolean {
    const patterns = [
      /'\s+or\s+/i,
      /'\s+and\s+/i,
      /select.*from.*where/i,
      /substring\s*\(/i,
      /count\s*\(\s*\*\s*\)/i,
      /'\s*=\s*'/i
    ];

    return patterns.some(pattern => pattern.test(query));
  }

  /**
   * Detect timing-based injection patterns
   */
  private static detectTimingInjection(query: string): boolean {
    const patterns = [
      /pg_sleep\s*\(/i,
      /sleep\s*\(/i,
      /benchmark\s*\(/i,
      /waitfor\s+delay/i,
      /case\s+when.*then.*pg_sleep/i
    ];

    return patterns.some(pattern => pattern.test(query));
  }

  /**
   * Detect error-based injection patterns
   */
  private static detectErrorInjection(query: string): boolean {
    const patterns = [
      /convert\s*\(/i,
      /cast\s*\(/i,
      /extractvalue\s*\(/i,
      /updatexml\s*\(/i
    ];

    return patterns.some(pattern => pattern.test(query));
  }

  /**
   * Generate educational hints based on injection attempt
   */
  static generateHints(query: string): string[] {
    const hints: string[] = [];
    const lowerQuery = query.toLowerCase();

    // Hints for boolean-based
    if (lowerQuery.includes('or') || lowerQuery.includes('and')) {
      hints.push('Boolean injection detected. Try extracting data with SUBSTRING.');
      hints.push('Example: \' OR (SELECT SUBSTRING(secret_value, 1, 1) FROM secrets) = \'h\' --');
    }

    // Hints for timing-based
    if (lowerQuery.includes('sleep') || lowerQuery.includes('pg_sleep')) {
      hints.push('Timing attack detected. Measure response time to infer conditions.');
      hints.push('Example: \' OR (SELECT CASE WHEN (1=1) THEN pg_sleep(3) ELSE 0 END) = 0 --');
    }

    // Hints for table discovery
    if (lowerQuery.includes('information_schema') || lowerQuery.includes('pg_catalog')) {
      hints.push('Schema discovery attempt. Try querying the secrets table.');
      hints.push('Target: SELECT secret_value FROM secrets WHERE secret_key = \'metadata_service_url\'');
    }

    // Generic hints
    if (hints.length === 0) {
      hints.push('Try boolean-based inference with OR conditions');
      hints.push('Use SUBSTRING to extract data character by character');
      hints.push('Consider timing attacks with pg_sleep');
    }

    return hints;
  }

  /**
   * Estimate extraction progress for character-by-character attacks
   */
  static estimateProgress(targetLength: number, extractedLength: number): {
    percentage: number;
    remaining: number;
    estimatedRequests: number;
  } {
    const percentage = (extractedLength / targetLength) * 100;
    const remaining = targetLength - extractedLength;
    
    // Estimate based on average 36 chars in charset (a-z, 0-9, :, /, ., -)
    const avgAttemptsPerChar = 18; // Binary search average
    const estimatedRequests = remaining * avgAttemptsPerChar;

    return {
      percentage: Math.round(percentage * 100) / 100,
      remaining,
      estimatedRequests
    };
  }

  /**
   * Validate extracted data format
   */
  static validateMetadataUrl(url: string): {
    valid: boolean;
    format: string;
    suggestions: string[];
  } {
    const suggestions: string[] = [];

    // Check if it looks like a URL
    const isUrl = /^https?:\/\//.test(url);
    
    if (!isUrl) {
      suggestions.push('URL should start with http:// or https://');
    }

    // Check for localhost
    const isLocalhost = /localhost|127\.0\.0\.1/.test(url);
    
    if (isLocalhost) {
      suggestions.push('Localhost URL detected - accessible via SSRF');
    }

    // Check for port
    const hasPort = /:\d+/.test(url);
    
    if (!hasPort && isLocalhost) {
      suggestions.push('Missing port number (expected :9090)');
    }

    const valid = isUrl && isLocalhost && hasPort;

    return {
      valid,
      format: 'http://localhost:9090',
      suggestions
    };
  }
}
