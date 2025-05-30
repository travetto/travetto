import { ControllerRegistry, EndpointDecorator } from '@travetto/web';

import { AuthVerifyInterceptor } from './interceptors/verify.ts';
import { AuthLoginInterceptor } from './interceptors/login.ts';
import { AuthLogoutInterceptor } from './interceptors/logout.ts';

/**
 * Authenticate an endpoint with a list of available identity sources
 * @param source The symbol to target the specific authenticator
 * @param sources Additional providers to support
 * @augments `@travetto/auth:Authenticate`
 */
export function Login(source: symbol, ...sources: symbol[]): EndpointDecorator {
  return ControllerRegistry.createInterceptorConfigDecorator(AuthLoginInterceptor, {
    providers: [source, ...sources],
    applies: true
  }, {
    responseContext: {
      isPrivate: true
    }
  });
}

/**
 * Ensure the controller/endpoint is authenticated, give a set of permissions
 * @param permissions Set of required/disallowed permissions
 * @augments `@travetto/auth:Authenticated`
 */
export function Authenticated(permissions: string[] = []): EndpointDecorator {
  return ControllerRegistry.createInterceptorConfigDecorator(AuthVerifyInterceptor, {
    state: 'authenticated',
    permissions,
    applies: true,
  }, {
    responseContext: {
      isPrivate: true
    }
  });
}

/**
 * Require the controller/endpoint to be unauthenticated
 * @augments `@travetto/auth:Unauthenticated`
 */
export function Unauthenticated(): EndpointDecorator {
  return ControllerRegistry.createInterceptorConfigDecorator(AuthVerifyInterceptor, {
    state: 'unauthenticated',
    applies: true
  });
}

/**
 * Logs a user out of the auth state
 * @augments `@travetto/auth:Logout`
 */
export function Logout(): EndpointDecorator {
  return ControllerRegistry.createInterceptorConfigDecorator(AuthLogoutInterceptor, { applies: true }, {
    responseContext: {
      isPrivate: true
    }
  });
}
