import { ControllerRegistry, FilterDecorator } from '@travetto/rest';
import { AppError } from '@travetto/base';
import { AuthUtil } from '@travetto/auth';
import { DependencyRegistry } from '@travetto/di';

import { AuthService } from './service';

/**
 * Authenticate an endpoint with a list of available identity sources
 * @param source The symbol to target the specific authenticator
 * @param sources Additional providers to support
 */
export function Authenticate(source: symbol, ...sources: symbol[]): FilterDecorator {
  const computed = [source, ...sources];
  return ControllerRegistry.createFilterDecorator(async (req, res) => {
    const svc = await DependencyRegistry.getInstance(AuthService);
    return svc.login(req, res, computed);
  });
}

/**
 * Ensure the controller/route is authenticated, give a set of permissions
 * @param include Set of required permissions
 * @param exclude Set of invalid permissions
 * @augments `@trv:auth/Authenticated`
 */
export function Authenticated(include: string[] = [], exclude: string[] = []): FilterDecorator {
  const { check } = AuthUtil.permissionChecker(include, exclude);

  return ControllerRegistry.createFilterDecorator((req, res) => {
    if (!req.auth) {
      throw new AppError('User is unauthenticated', 'authentication');
    } else if (!check(new Set(req.auth.permissions ?? []))) {
      throw new AppError('Access denied', 'permissions');
    }
  });
}

/**
 * Require the controller/route to be unauthenticated
 * @augments `@trv:auth/Unauthenticated`
 */
export function Unauthenticated(): FilterDecorator {
  return ControllerRegistry.createFilterDecorator(req => {
    if (req.auth) {
      throw new AppError('User is authenticated', 'authentication');
    }
  });
}