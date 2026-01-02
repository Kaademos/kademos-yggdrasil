import { Request, Response, NextFunction } from 'express';
import { enhancedSecurityHeaders } from '../src/middleware/security-headers';

describe('enhancedSecurityHeaders middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;
  let setHeaderSpy: jest.Mock;

  beforeEach(() => {
    mockRequest = {};
    setHeaderSpy = jest.fn();
    mockResponse = {
      setHeader: setHeaderSpy,
      locals: {},
    };
    nextFunction = jest.fn();
  });

  describe('development mode', () => {
    const middleware = enhancedSecurityHeaders('development');

    it('should set X-Content-Type-Options header', () => {
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(setHeaderSpy).toHaveBeenCalledWith(
        'X-Content-Type-Options',
        'nosniff'
      );
    });

    it('should set robust Content-Security-Policy header', () => {
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      const cspCall = setHeaderSpy.mock.calls.find(
        (call) => call[0] === 'Content-Security-Policy'
      );
      expect(cspCall).toBeDefined();

      const csp = cspCall[1];
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self' 'nonce-");
      expect(csp).toContain("style-src 'self' 'unsafe-inline'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("base-uri 'none'");
    });

    it('should set X-Frame-Options header', () => {
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(setHeaderSpy).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
    });

    it('should set Referrer-Policy header', () => {
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(setHeaderSpy).toHaveBeenCalledWith(
        'Referrer-Policy',
        'strict-origin-when-cross-origin'
      );
    });

    it('should generate CSP nonce', () => {
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.locals?.nonce).toBeTruthy();
      expect(typeof mockResponse.locals?.nonce).toBe('string');
    });

    it('should not set HSTS header in development', () => {
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      const hstsCall = setHeaderSpy.mock.calls.find(
        (call) => call[0] === 'Strict-Transport-Security'
      );
      expect(hstsCall).toBeUndefined();
    });

    it('should call next middleware', () => {
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });
  });

  describe('production mode', () => {
    const middleware = enhancedSecurityHeaders('production');

    it('should set HSTS header with 1 year max-age', () => {
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(setHeaderSpy).toHaveBeenCalledWith(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains'
      );
    });

    it('should set all security headers', () => {
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(setHeaderSpy).toHaveBeenCalledWith(
        'X-Content-Type-Options',
        'nosniff'
      );
      expect(setHeaderSpy).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
      expect(setHeaderSpy).toHaveBeenCalledWith(
        'Referrer-Policy',
        'strict-origin-when-cross-origin'
      );

      const cspCall = setHeaderSpy.mock.calls.find(
        (call) => call[0] === 'Content-Security-Policy'
      );
      expect(cspCall).toBeDefined();
    });
  });
});
