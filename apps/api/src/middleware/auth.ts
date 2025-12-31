import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config';
import { AuthUser } from '../types';
import { Role } from '@prisma/client';

const TOKEN_COOKIE = 'token';

export function issueToken(res: Response, payload: AuthUser) {
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  res.cookie(TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
  });
}

export function clearToken(res: Response) {
  res.clearCookie(TOKEN_COOKIE);
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const raw = req.cookies?.[TOKEN_COOKIE] || (req.headers.authorization?.replace('Bearer ', '') ?? '');
  if (!raw) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const decoded = jwt.verify(raw, JWT_SECRET) as AuthUser;
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireRole(roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return next();
  };
}

export function requireOwnershipOrAdmin(ownerId: string | null | undefined, user: AuthUser) {
  if (!user) return false;
  if (user.role === Role.ADMIN) return true;
  return ownerId === user.id;
}
