import { Request, Response, NextFunction } from 'express';
import { ControllerRegistry, AppError } from '@travetto/express';

export function Authenticate() {
  return ControllerRegistry.filterAdder((req, res) => req.auth.login(req, res));
}

export async function requireAuth(config: { include: string[], exclude: string[] }, req: Request, res: Response) {
  if (req.auth.unauthenticated) {
    throw new AppError('User is required', 401);
  }
  const { include, exclude } = config;

  const perms = req.auth.context.permissions;

  if (exclude.length && exclude.find(x => perms.has(x))) {
    throw new AppError('Access forbidden', 403);
  }
  if (include.length && include.find(x => !perms.has(x))) {
    throw new AppError('Access forbidden', 403);
  }
}

export function Authenticated(include: string[] = [], exclude: string[] = []) {
  return ControllerRegistry.filterAdder(requireAuth.bind(null, {
    include: include.map(x => x.toLowerCase()),
    exclude: exclude.map(x => x.toLowerCase())
  }));
}

export function Unauthenticated() {
  return ControllerRegistry.filterAdder(function (req: Request) {
    if (!req.auth.unauthenticated) {
      throw new AppError('User cannot be authenticated', 401);
    }
  });
}