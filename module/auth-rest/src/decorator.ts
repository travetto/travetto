import { ControllerRegistry, EndpointDecorator } from '@travetto/rest';
import { AppError } from '@travetto/base';
import { AuthUtil } from '@travetto/auth';

// TODO: Document
export function Authenticate(provider: symbol, ...providers: symbol[]) {
  const computed = [provider, ...providers];
  return ControllerRegistry.createFilterDecorator(req => req.login(computed)) as EndpointDecorator;
}

// TODO: Document
export function Authenticated(include: string[] = [], exclude: string[] = []) {
  const checker = AuthUtil.permissionSetChecker(new Set(include), new Set(exclude));

  return ControllerRegistry.createFilterDecorator((req, res) => {
    if (!req.auth.principal) {
      throw new AppError('User is unauthenticated', 'authentication');
    } else if (!checker(req.auth.permissionSet)) {
      throw new AppError('Access denied', 'permissions');
    }
  });
}

export function Unauthenticated() {
  return ControllerRegistry.createFilterDecorator(req => {
    if (!!req.auth.principal) {
      throw new AppError('User is authenticated', 'authentication');
    }
  });
}