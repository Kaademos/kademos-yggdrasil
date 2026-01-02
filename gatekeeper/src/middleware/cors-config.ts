import cors from 'cors';

export function createCorsMiddleware(allowedOrigin?: string) {
  // ASVS V3.4.2: Static allowlist of origins
  const allowedOrigins: string[] = [
    'http://localhost:8080',
    ...(allowedOrigin ? [allowedOrigin] : []),
  ];

  return cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true, // Allow cookies
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
  });
}
