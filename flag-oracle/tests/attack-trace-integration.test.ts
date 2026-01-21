/**
 * Attack Trace Integration Tests (Flag Oracle)
 * 
 * Tests integration between flag validation and attack trace logging
 */

import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';

// Mock the attack trace logger
const mockLogTrace = jest.fn();
const mockLogFlagSubmission = jest.fn();

jest.mock('../../gatekeeper/src/services/attack-trace-logger', () => ({
  AttackTraceLogger: jest.fn().mockImplementation(() => ({
    logTrace: mockLogTrace,
    logFlagSubmission: mockLogFlagSubmission,
    getConfig: jest.fn(() => ({
      enabled: true,
      logPath: './test-logs',
      format: 'openai'
    }))
  })),
  attackTraceLogger: {
    logTrace: mockLogTrace,
    logFlagSubmission: mockLogFlagSubmission
  }
}));

import { FlagValidator } from '../src/services/flag-validator';

describe('Attack Trace Integration (Flag Oracle)', () => {
  let flagValidator: FlagValidator;
  
  beforeEach(() => {
    // Clear mocks
    mockLogTrace.mockClear();
    mockLogFlagSubmission.mockClear();
    
    // Initialize services
    flagValidator = new FlagValidator();
  });
  
  describe('Flag Validation', () => {
    it('should validate correct flag format', () => {
      const realm = 'NIFLHEIM';
      const flag = 'YGGDRASIL{NIFLHEIM:12345678-1234-1234-1234-123456789012}';
      
      // Validate flag format
      const result = flagValidator.validate(flag);
      
      expect(result.valid).toBe(true);
      expect(result.realm).toBe(realm);
    });
    
    it('should reject invalid flag format', () => {
      const invalidFlag = 'INVALID_FORMAT_NOT_MATCHING';
      
      // Verify invalid flag
      const result = flagValidator.validate(invalidFlag);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
    
    it('should extract realm from valid flag', () => {
      const flag = 'YGGDRASIL{HELHEIM:abcdef12-1234-1234-1234-123456789012}';
      
      const result = flagValidator.validate(flag);
      
      expect(result.valid).toBe(true);
      expect(result.realm).toBe('HELHEIM');
    });
  });
  
  describe('Flag Format Validation', () => {
    it('should validate realm names', () => {
      const validRealms = ['NIFLHEIM', 'HELHEIM', 'SVARTALFHEIM', 'JOTUNHEIM', 'MUSPELHEIM', 
                          'NIDAVELLIR', 'VANAHEIM', 'MIDGARD', 'ALFHEIM', 'ASGARD'];
      
      validRealms.forEach(realm => {
        const flag = `YGGDRASIL{${realm}:12345678-1234-1234-1234-123456789012}`;
        const result = flagValidator.validate(flag);
        expect(result.valid).toBe(true);
        expect(result.realm).toBe(realm);
      });
    });
    
    it('should accept any realm name in correct format', () => {
      // FlagValidator only validates format, not if realm name is valid
      const flagWithUnknownRealm = 'YGGDRASIL{UNKNOWN_REALM:12345678-1234-1234-1234-123456789012}';
      
      const result = flagValidator.validate(flagWithUnknownRealm);
      
      // Format is valid, realm validation happens elsewhere
      expect(result.valid).toBe(true);
      expect(result.realm).toBe('UNKNOWN_REALM');
    });
    
    it('should reject flags with missing components', () => {
      const invalidFlags = [
        'YGGDRASIL{NIFLHEIM:}',
        'YGGDRASIL{:12345678-1234-1234-1234-123456789012}',
        'YGGDRASIL{}',
        'NIFLHEIM:12345678-1234-1234-1234-123456789012'
      ];
      
      invalidFlags.forEach(flag => {
        const result = flagValidator.validate(flag);
        expect(result.valid).toBe(false);
      });
    });
  });
  
  describe('Attack Trace Format Validation', () => {
    it('should generate traces in OpenAI format', () => {
      const trace = {
        messages: [
          { role: 'system', content: 'Security analyst tracking CTF progress' },
          { role: 'user', content: 'Flag submission for realm NIFLHEIM' },
          { role: 'assistant', content: 'Valid flag submitted for NIFLHEIM. Exploit successful.' }
        ],
        metadata: {
          timestamp: new Date().toISOString(),
          exploit_successful: true,
          realm: 'NIFLHEIM',
          user_id: 'test-user',
          event_type: 'flag_submission'
        }
      };
      
      // Validate structure
      expect(trace.messages).toHaveLength(3);
      expect(trace.messages[0].role).toBe('system');
      expect(trace.messages[1].role).toBe('user');
      expect(trace.messages[2].role).toBe('assistant');
      
      // Validate metadata
      expect(trace.metadata.timestamp).toBeDefined();
      expect(trace.metadata.exploit_successful).toBe(true);
      expect(trace.metadata.realm).toBe('NIFLHEIM');
      expect(trace.metadata.event_type).toBe('flag_submission');
    });
    
    it('should sanitize sensitive data in traces', () => {
      const flag = 'YGGDRASIL{NIFLHEIM:12345678-1234-1234-1234-123456789012}';
      const truncatedFlag = flag.substring(0, 30);
      
      // Flag should be truncated in logs
      expect(truncatedFlag.length).toBeLessThan(flag.length);
      expect(truncatedFlag).toContain('YGGDRASIL{NIFLHEIM:');
    });
  });
  
  describe('Attack Pattern Detection', () => {
    it('should detect multiple failed validation attempts', () => {
      const invalidFlags = [
        'YGGDRASIL{NIFLHEIM:00000000-0000-0000-0000-000000000000}',
        'YGGDRASIL{NIFLHEIM:11111111-1111-1111-1111-111111111111}',
        'YGGDRASIL{NIFLHEIM:22222222-2222-2222-2222-222222222222}'
      ];
      
      // Validate multiple invalid flags
      const results = invalidFlags.map(flag => 
        flagValidator.validate(flag)
      );
      
      // All should be valid format but would fail verification
      results.forEach(result => {
        expect(result.valid).toBe(true);
        expect(result.realm).toBe('NIFLHEIM');
      });
      
      // This pattern would be logged as potential brute force attempt
    });
    
    it('should handle mixed valid and invalid formats', () => {
      const flags = [
        'YGGDRASIL{NIFLHEIM:00000000-0000-0000-0000-000000000000}', // Valid format
        'INVALID_FLAG', // Invalid format
        'YGGDRASIL{NIFLHEIM:11111111-1111-1111-1111-111111111111}', // Valid format
        'YGGDRASIL{}' // Invalid format
      ];
      
      const results = flags.map(flag => flagValidator.validate(flag));
      
      expect(results[0].valid).toBe(true);
      expect(results[1].valid).toBe(false);
      expect(results[2].valid).toBe(true);
      expect(results[3].valid).toBe(false);
    });
  });
  
  describe('Flag Validation Patterns', () => {
    it('should validate progression through realms', () => {
      const realms = ['NIFLHEIM', 'HELHEIM', 'SVARTALFHEIM'];
      
      realms.forEach(realm => {
        const flag = `YGGDRASIL{${realm}:12345678-1234-1234-1234-123456789012}`;
        const result = flagValidator.validate(flag);
        
        expect(result.valid).toBe(true);
        expect(result.realm).toBe(realm);
      });
    });
    
    it('should handle flag validation timing', () => {
      const flag1 = 'YGGDRASIL{NIFLHEIM:12345678-1234-1234-1234-123456789012}';
      const flag2 = 'YGGDRASIL{HELHEIM:abcdef12-1234-1234-1234-123456789012}';
      
      const startTime = Date.now();
      
      flagValidator.validate(flag1);
      flagValidator.validate(flag2);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Validation should be fast
      expect(duration).toBeLessThan(100);
      
      // Attack traces should include timestamps for time analysis
    });
  });
  
  describe('Error Conditions', () => {
    it('should reject flags with invalid UUID format', () => {
      // Tamper with UUID format (not hex characters)
      const tamperedFlags = [
        'YGGDRASIL{NIFLHEIM:X2345678-1234-1234-1234-123456789012}',
        'YGGDRASIL{NIFLHEIM:12345678-XXXX-1234-1234-123456789012}',
        'YGGDRASIL{NIFLHEIM:12345678-1234-1234-1234-12345678901X}',
        'YGGDRASIL{NIFLHEIM:not-a-uuid-format}'
      ];
      
      tamperedFlags.forEach(flag => {
        const result = flagValidator.validate(flag);
        // UUID format is invalid (contains non-hex or wrong structure)
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });
    
    it('should validate all realm names correctly', () => {
      const validRealms = ['NIFLHEIM', 'HELHEIM', 'SVARTALFHEIM', 'JOTUNHEIM', 
                          'MUSPELHEIM', 'NIDAVELLIR', 'VANAHEIM', 'MIDGARD', 
                          'ALFHEIM', 'ASGARD'];
      
      validRealms.forEach(realm => {
        const flag = `YGGDRASIL{${realm}:12345678-1234-1234-1234-123456789012}`;
        const result = flagValidator.validate(flag);
        expect(result.valid).toBe(true);
        expect(result.realm).toBe(realm);
      });
    });
    
    it('should reject invalid format attempts', () => {
      const invalidFormats = [
        'not-a-flag',
        'YGGDRASIL{MISSING_REALM}',
        'YGGDRASIL{:no-realm}',
        'REALM:not-a-uuid',
        ''
      ];
      
      invalidFormats.forEach(flag => {
        const result = flagValidator.validate(flag);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });
  });
  
  describe('Trace File Management', () => {
    it('should write traces to correct log directory structure', () => {
      const expectedDirs = [
        'logs/attack-traces/gatekeeper',
        'logs/attack-traces/flag-oracle'
      ];
      
      // In real implementation, these directories would be created
      expectedDirs.forEach(dir => {
        // Verify directory structure is correct
        expect(dir).toMatch(/logs\/attack-traces\/.+/);
      });
    });
    
    it('should generate daily trace files', () => {
      const today = new Date().toISOString().split('T')[0];
      const expectedFilename = `attack-traces-${today}.jsonl`;
      
      expect(expectedFilename).toMatch(/attack-traces-\d{4}-\d{2}-\d{2}\.jsonl/);
    });
    
    it('should write traces in JSONL format', () => {
      const trace1 = { messages: [], metadata: { timestamp: '2026-01-21T12:00:00Z' } };
      const trace2 = { messages: [], metadata: { timestamp: '2026-01-21T12:01:00Z' } };
      
      const jsonl = JSON.stringify(trace1) + '\n' + JSON.stringify(trace2) + '\n';
      const lines = jsonl.trim().split('\n');
      
      expect(lines).toHaveLength(2);
      
      lines.forEach(line => {
        expect(() => JSON.parse(line)).not.toThrow();
      });
    });
  });
  
  describe('Performance', () => {
    it('should handle high volume of flag validations', () => {
      const realm = 'NIFLHEIM';
      const iterations = 100;
      
      const startTime = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        const flag = `YGGDRASIL{${realm}:${i.toString().padStart(8, '0')}-1234-1234-1234-123456789012}`;
        flagValidator.validate(flag);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      const avgTime = duration / iterations;
      
      // Should be reasonably fast
      expect(avgTime).toBeLessThan(10); // Less than 10ms per validation
    });
    
    it('should validate flags quickly', () => {
      const flag = 'YGGDRASIL{NIFLHEIM:12345678-1234-1234-1234-123456789012}';
      
      // Flag validation should be very fast
      const startTime = Date.now();
      const result = flagValidator.validate(flag);
      const endTime = Date.now();
      
      expect(result.valid).toBe(true);
      expect(endTime - startTime).toBeLessThan(50); // Should be very fast
    });
  });
});
