import { Request, Response } from 'express';
import { ControllerRegistry, AppError } from '@travetto/express';
import { ERR_UNAUTHENTICATED, ERR_AUTHENTICATED, ERR_FORBIDDEN, ERR_INVALID_CREDS } from '../../src/types';

export function Authenticate(provider: symbol, ...providers: symbol[]) {
  const computed = [provider, ...providers];
  return ControllerRegistry.filterAdder(async (req, res) => {
    try {
      await req.doLogin(computed);
    } catch (e) {
      if (e.message === ERR_INVALID_CREDS) {
        const err = new AppError(e.message, 400);
        err.stack = e.stack;
        throw err;
      } else {
        throw e;
      }
    }
  });
}

export async function requireAuth(config: { include: string[], exclude: string[] }, req: Request, res: Response) {
  try {
    req.auth.checkPermissions(config.include, config.exclude);
  } catch (e) {
    let status = 500;
    switch (e.message) {
      case ERR_UNAUTHENTICATED: status = 403; break;
      case ERR_AUTHENTICATED: status = 403; break;
      case ERR_FORBIDDEN: status = 401; break;
    }
    const err = new AppError(e.message, status);
    err.stack = e.stack;
    throw err;
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
      throw new AppError(ERR_UNAUTHENTICATED, 401);
    }
  });
}