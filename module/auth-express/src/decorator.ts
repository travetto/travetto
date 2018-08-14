import { Request } from 'express';
import { ControllerRegistry, AppError, EndpointDecorator } from '@travetto/express';
import { ERR_UNAUTHENTICATED, ERR_AUTHENTICATED, ERR_FORBIDDEN, ERR_INVALID_CREDS } from '@travetto/auth';

export function Authenticate(provider: symbol, ...providers: symbol[]) {
  const computed = [provider, ...providers];
  return ControllerRegistry.createFilterDecorator(async (req) => {
    try {
      await req.auth.login(computed);
    } catch (e) {
      if (e.message === ERR_INVALID_CREDS) {
        const err = new AppError(e.message, 400);
        err.stack = e.stack;
        throw err;
      } else {
        throw e;
      }
    }
  }) as EndpointDecorator;
}

export async function requireAuth(config: { include: string[], exclude: string[] }, req: Request) {
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
  return ControllerRegistry.createFilterDecorator(requireAuth.bind(null, {
    include: include.map(x => x.toLowerCase()),
    exclude: exclude.map(x => x.toLowerCase())
  }));
}

export function Unauthenticated() {
  return ControllerRegistry.createFilterDecorator(req => {
    if (!req.auth.unauthenticated) {
      throw new AppError(ERR_UNAUTHENTICATED, 401);
    }
  });
}