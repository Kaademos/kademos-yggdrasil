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
});
