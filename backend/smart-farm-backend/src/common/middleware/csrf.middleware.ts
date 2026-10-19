import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Ensure a CSRF cookie exists (double-submit token)
    const cookieName = 'sf_csrf';
    let token = req.cookies?.[cookieName] as string | undefined;
    if (!token) {
      token = randomBytes(32).toString('hex');
      res.cookie(cookieName, token, {
        httpOnly: false, // must be readable by frontend
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24, // 1 day
        path: '/',
      });
    }

    // Only enforce on state-changing methods
    const method = req.method.toUpperCase();
    const safe = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
    if (safe) return next();

    // Allow login/register/logout without CSRF (token may not be present yet)
    const url = (req.originalUrl || req.url || req.path || '').toLowerCase();
    if (
      url.includes('/auth/csrf') ||
      url.includes('/auth/login') ||
      url.includes('/auth/logout') ||
      url.includes('/users/register') ||
      url.includes('/notifications/mark-read') ||
      url.includes('/notifications/mark-all-read') ||
      url.includes('/notifications/')
    ) {
      return next();
    }

    const headerToken = (req.headers['x-csrf-token'] as string) || '';
    if (!headerToken || headerToken !== token) {
      return res.status(403).json({ message: 'Invalid CSRF token' });
    }

    return next();
  }
}


