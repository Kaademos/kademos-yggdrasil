/**
 * Unit Tests: SqliHelper
 * Tests SQL injection detection and analysis functionality
 */

import { SqliHelper } from '../../src/services/sqli-helper';

describe('SqliHelper', () => {
  describe('analyzeQuery', () => {
    test('should detect boolean-based SQL injection', () => {
      const query = "' OR 1=1 --";
      const analysis = SqliHelper.analyzeQuery(query);

      expect(analysis.detected).toBe(true);
      expect(analysis.type).toBe('boolean');
      expect(analysis.confidence).toBe('high');
      expect(analysis.techniques).toContain('Boolean-based blind SQLi');
    });

    test('should detect UNION-based SQL injection', () => {
      const query = "' UNION SELECT username, password FROM users --";
      const analysis = SqliHelper.analyzeQuery(query);

      expect(analysis.detected).toBe(true);
      expect(analysis.type).toBe('union');
      expect(analysis.confidence).toBe('high');
      expect(analysis.techniques).toContain('UNION-based SQLi');
    });

    test('should detect timing-based SQL injection', () => {
      const query = "' OR pg_sleep(5) --";
      const analysis = SqliHelper.analyzeQuery(query);

      expect(analysis.detected).toBe(true);
      expect(analysis.type).toBe('timing');
      expect(analysis.confidence).toBe('high');
      expect(analysis.techniques).toContain('Timing-based blind SQLi');
    });

    test('should not detect injection in clean queries', () => {
      const query = "user@example.com";
      const analysis = SqliHelper.analyzeQuery(query);

      expect(analysis.detected).toBe(false);
      expect(analysis.type).toBe('none');
    });

    test('should detect SUBSTRING-based extraction', () => {
      const query = "' OR (SELECT SUBSTRING(secret_value, 1, 1) FROM secrets) = 'h' --";
      const analysis = SqliHelper.analyzeQuery(query);

      expect(analysis.detected).toBe(true);
      expect(analysis.type).toBe('boolean');
      expect(analysis.hints.some(h => h.includes('SUBSTRING'))).toBe(true);
    });

    test('should detect COUNT-based checks', () => {
      const query = "' OR (SELECT COUNT(*) FROM secrets) > 0 --";
      const analysis = SqliHelper.analyzeQuery(query);

      expect(analysis.detected).toBe(true);
      expect(analysis.type).toBe('boolean');
    });
  });

  describe('generateHints', () => {
    test('should provide hints for boolean injection', () => {
      const query = "' OR 1=1 --";
      const hints = SqliHelper.generateHints(query);

      expect(hints.length).toBeGreaterThan(0);
      expect(hints.some(h => h.includes('Boolean'))).toBe(true);
      expect(hints.some(h => h.includes('SUBSTRING'))).toBe(true);
    });

    test('should provide hints for timing attacks', () => {
      const query = "' OR pg_sleep(3) --";
      const hints = SqliHelper.generateHints(query);

      expect(hints.some(h => h.includes('Timing'))).toBe(true);
      expect(hints.some(h => h.includes('pg_sleep'))).toBe(true);
    });

    test('should provide hints for schema discovery', () => {
      const query = "' OR 1=1 FROM information_schema.tables --";
      const hints = SqliHelper.generateHints(query);

      expect(hints.some(h => h.includes('Schema'))).toBe(true);
      expect(hints.some(h => h.includes('secrets table'))).toBe(true);
    });

    test('should provide generic hints for unknown patterns', () => {
      const query = "test_user@example.com";
      const hints = SqliHelper.generateHints(query);

      expect(hints.length).toBeGreaterThan(0);
      expect(hints.some(h => h.includes('boolean'))).toBe(true);
    });
  });

  describe('estimateProgress', () => {
    test('should calculate percentage correctly', () => {
      const result = SqliHelper.estimateProgress(30, 15);

      expect(result.percentage).toBe(50);
      expect(result.remaining).toBe(15);
    });

    test('should estimate remaining requests', () => {
      const result = SqliHelper.estimateProgress(30, 0);

      expect(result.estimatedRequests).toBeGreaterThan(0);
      expect(result.remaining).toBe(30);
    });

    test('should handle 100% completion', () => {
      const result = SqliHelper.estimateProgress(30, 30);

      expect(result.percentage).toBe(100);
      expect(result.remaining).toBe(0);
      expect(result.estimatedRequests).toBe(0);
    });
  });

  describe('validateMetadataUrl', () => {
    test('should validate correct metadata URL', () => {
      const url = 'http://localhost:9090';
      const result = SqliHelper.validateMetadataUrl(url);

      expect(result.valid).toBe(true);
      expect(result.format).toBe('http://localhost:9090');
    });

    test('should detect missing http protocol', () => {
      const url = 'localhost:9090';
      const result = SqliHelper.validateMetadataUrl(url);

      expect(result.valid).toBe(false);
      expect(result.suggestions.some(s => s.includes('http'))).toBe(true);
    });

    test('should detect missing port', () => {
      const url = 'http://localhost';
      const result = SqliHelper.validateMetadataUrl(url);

      expect(result.valid).toBe(false);
      expect(result.suggestions.some(s => s.includes('port'))).toBe(true);
    });

    test('should identify localhost URLs', () => {
      const url = 'http://localhost:9090';
      const result = SqliHelper.validateMetadataUrl(url);

      expect(result.suggestions.some(s => s.includes('SSRF'))).toBe(true);
    });

    test('should handle 127.0.0.1 format', () => {
      const url = 'http://127.0.0.1:9090';
      const result = SqliHelper.validateMetadataUrl(url);

      expect(result.valid).toBe(true);
    });
  });
});
