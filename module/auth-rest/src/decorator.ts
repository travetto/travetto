import { ControllerRegistry, EndpointDecorator } from '@travetto/rest';
import { AppError } from '@travetto/base';
import { AuthUtil } from '@travetto/auth';

/**
 * Authenticate an endpoint with a list of available identity sources
 * @param source The symbol to target the specific authenticator
 * @param sources Additional providers to support
 */
export function Authenticate(source: symbol, ...sources: symbol[]) {
  const computed = [source, ...sources];
  return ControllerRegistry.createFilterDecorator(req => req.login(computed)) as EndpointDecorator;
}

/**
 * Ensure the controller/route is authenticated, give a set of permissions
 * @param include Set of required permissions
 * @param exclude Set of invalid permissions
 */
export function Authenticated(include: string[] = [], exclude: string[] = []) {
  const checker = AuthUtil.permissionSetChecker(include, exclude);

  return ControllerRegistry.createFilterDecorator((req, res) => {
    if (!req.auth.principal) {
      throw new AppError('User is unauthenticated', 'authentication');
    } else if (!checker(req.auth.permissionSet)) {
      throw new AppError('Access denied', 'permissions');
    }
  });
}

/**
 * Require the controller/route to be unauthenticated
 */
export function Unauthenticated() {
  return ControllerRegistry.createFilterDecorator(req => {
    if (!!req.auth.principal) {
      throw new AppError('User is authenticated', 'authentication');
    }
  });
}