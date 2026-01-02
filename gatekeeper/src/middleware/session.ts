import session from 'express-session';
import { Config } from '../config';

export function createSessionMiddleware(config: Config) {
  const isProduction = config.nodeEnv === 'production';

  return session({
    secret: config.sessionSecret,
    name: '__Host-yggdrasil-session',
    cookie: {
      httpOnly: true, // ASVS V3.3.4
      secure: isProduction, // ASVS V3.3.1 (HTTPS only in production)
      sameSite: 'strict', // ASVS V3.3.2
      maxAge: config.sessionMaxAge,
      path: '/',
    },
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reset expiry on each request
  });
}
