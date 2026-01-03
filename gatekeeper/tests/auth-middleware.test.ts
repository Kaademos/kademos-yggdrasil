import { Request, Response, NextFunction } from 'express';
import { createAuthMiddleware } from '../src/middleware/auth';
import { InMemoryUserRepository } from '../src/repositories/user-repository';
import { User } from '../src/models/user';

describe('Auth Middleware', () => {
  let userRepository: InMemoryUserRepository;
  let middleware: ReturnType<typeof createAuthMiddleware>;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFn: NextFunction;

  beforeEach(async () => {
    userRepository = new InMemoryUserRepository(4, false);
    await userRepository.clear();
    middleware = createAuthMiddleware(userRepository);

    mockReq = {
      session: {} as any,
      sessionID: 'test-session-id',
      path: '/test',
      ip: '127.0.0.1',
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    nextFn = jest.fn();
  });

  describe('requireAuth', () => {
    it('should call next() for authenticated user', async () => {
      const user = await userRepository.create('testuser', 'password123');
      mockReq.session = { userId: user.id } as any;

      await middleware.requireAuth(
        mockReq as Request,
        mockRes as Response,
        nextFn
      );

      expect(nextFn).toHaveBeenCalled();
      expect(mockReq.user).toBeTruthy();
      expect(mockReq.user?.id).toBe(user.id);
      expect(mockReq.user?.username).toBe('testuser');
    });

    it('should return 401 for unauthenticated user', async () => {
      mockReq.session = {} as any; // No userId

      await middleware.requireAuth(
        mockReq as Request,
        mockRes as Response,
        nextFn
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Authentication required',
      });
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('should return 401 for invalid user ID', async () => {
      const destroySpy = jest.fn((callback) => callback && callback());
      mockReq.session = {
        userId: 'invalid-user-id',
        destroy: destroySpy,
      } as any;

      await middleware.requireAuth(
        mockReq as Request,
        mockRes as Response,
        nextFn
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Authentication required',
      });
      expect(nextFn).not.toHaveBeenCalled();
      expect(destroySpy).toHaveBeenCalled();
    });

    it('should destroy session for invalid user', async () => {
      const destroySpy = jest.fn((callback) => callback());
      mockReq.session = {
        userId: 'invalid-user-id',
        destroy: destroySpy,
      } as any;

      await middleware.requireAuth(
        mockReq as Request,
        mockRes as Response,
        nextFn
      );

      expect(destroySpy).toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    it('should attach user for authenticated request', async () => {
      const user = await userRepository.create('testuser', 'password123');
      mockReq.session = { userId: user.id } as any;

      await middleware.optionalAuth(
        mockReq as Request,
        mockRes as Response,
        nextFn
      );

      expect(nextFn).toHaveBeenCalled();
      expect(mockReq.user).toBeTruthy();
      expect(mockReq.user?.id).toBe(user.id);
    });

    it('should call next() without user for unauthenticated request', async () => {
      mockReq.session = {} as any;

      await middleware.optionalAuth(
        mockReq as Request,
        mockRes as Response,
        nextFn
      );

      expect(nextFn).toHaveBeenCalled();
      expect(mockReq.user).toBeUndefined();
    });

    it('should call next() and destroy session for invalid user', async () => {
      const destroySpy = jest.fn((callback) => callback());
      mockReq.session = {
        userId: 'invalid-user-id',
        destroy: destroySpy,
      } as any;

      await middleware.optionalAuth(
        mockReq as Request,
        mockRes as Response,
        nextFn
      );

      expect(nextFn).toHaveBeenCalled();
      expect(mockReq.user).toBeUndefined();
      expect(destroySpy).toHaveBeenCalled();
    });

    it('should continue on error', async () => {
      const errorRepo = {
        findById: jest.fn().mockRejectedValue(new Error('DB error')),
      };
      const errorMiddleware = createAuthMiddleware(errorRepo as any);
      mockReq.session = { userId: 'user123' } as any;

      await errorMiddleware.optionalAuth(
        mockReq as Request,
        mockRes as Response,
        nextFn
      );

      expect(nextFn).toHaveBeenCalled();
      expect(mockReq.user).toBeUndefined();
    });
  });

  describe('ensureSession', () => {
    it('should call next() for anonymous user with session', async () => {
      mockReq.session = {} as any;
      mockReq.sessionID = 'anon-session-123';

      await middleware.ensureSession(
        mockReq as Request,
        mockRes as Response,
        nextFn
      );

      expect(nextFn).toHaveBeenCalled();
      expect(mockReq.user).toBeUndefined();
    });

    it('should attach user if logged in', async () => {
      const user = await userRepository.create('testuser', 'password123');
      mockReq.session = { userId: user.id } as any;
      mockReq.sessionID = 'logged-in-session';

      await middleware.ensureSession(
        mockReq as Request,
        mockRes as Response,
        nextFn
      );

      expect(nextFn).toHaveBeenCalled();
      expect(mockReq.user).toBeTruthy();
      expect(mockReq.user?.id).toBe(user.id);
    });

    it('should call next() without user if userId invalid', async () => {
      mockReq.session = { userId: 'invalid-id' } as any;
      mockReq.sessionID = 'session-with-invalid-user';

      await middleware.ensureSession(
        mockReq as Request,
        mockRes as Response,
        nextFn
      );

      expect(nextFn).toHaveBeenCalled();
      expect(mockReq.user).toBeUndefined();
    });

    it('should return 500 if no session', async () => {
      mockReq.session = undefined as any;

      await middleware.ensureSession(
        mockReq as Request,
        mockRes as Response,
        nextFn
      );

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Session initialization failed',
      });
      expect(nextFn).not.toHaveBeenCalled();
    });
  });

  describe('requireAdmin', () => {
    it('should call next() for authenticated admin', async () => {
      const user = await userRepository.create('admin', 'password123');
      mockReq.session = { userId: user.id } as any;

      await middleware.requireAdmin(
        mockReq as Request,
        mockRes as Response,
        nextFn
      );

      expect(nextFn).toHaveBeenCalled();
      expect(mockReq.user?.id).toBe(user.id);
    });

    it('should return 401 for unauthenticated request', async () => {
      mockReq.session = {} as any;

      await middleware.requireAdmin(
        mockReq as Request,
        mockRes as Response,
        nextFn
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Admin authentication required',
      });
      expect(nextFn).not.toHaveBeenCalled();
    });
  });
});
