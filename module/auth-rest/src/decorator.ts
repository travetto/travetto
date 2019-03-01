import { ControllerRegistry, EndpointDecorator, Request } from '@travetto/rest';
import { ERR_UNAUTHENTICATED, ERR_AUTHENTICATED, ERR_FORBIDDEN, ERR_INVALID_CREDS } from '@travetto/auth';
import { AppError, ErrorCategory } from '@travetto/base';

export function Authenticate(provider: symbol, ...providers: symbol[]) {
  const computed = [provider, ...providers];
  return ControllerRegistry.createFilterDecorator(async (req) => {
    try {
      await req.auth.login(computed);
    } catch (e) {
      if (e.message === ERR_INVALID_CREDS) {
        const err = new AppError(e.message, 'authentication');
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
    let status: ErrorCategory = 'general';
    switch (e.message) {
      case ERR_UNAUTHENTICATED: status = 'authentication'; break;
      case ERR_AUTHENTICATED: status = 'permissions'; break;
      case ERR_FORBIDDEN: status = 'permissions'; break;
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
      throw new AppError(ERR_UNAUTHENTICATED, 'authentication');
    }
  });
}