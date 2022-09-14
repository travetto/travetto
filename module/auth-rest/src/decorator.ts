import { ControllerRegistry, EndpointDecorator } from '@travetto/rest';

import { AuthVerifyInterceptor } from './interceptors/authenticate';
import { AuthLoginInterceptor } from './interceptors/login';

/**
 * Authenticate an endpoint with a list of available identity sources
 * @param source The symbol to target the specific authenticator
 * @param sources Additional providers to support
 * @augments `@trv:auth/Authenticate`
 */
export function Authenticate(source: symbol, ...sources: symbol[]): EndpointDecorator {
  return ControllerRegistry.createInterceptorConfigDecorator(AuthLoginInterceptor, {
    providers: [source, ...sources]
  });
}

/**
 * Ensure the controller/route is authenticated, give a set of permissions
 * @param roles Set of required/disallowed permissions
 * @augments `@trv:auth/Authenticated`
 */
export function Authenticated(roles: string[] = []): EndpointDecorator {
  return ControllerRegistry.createInterceptorConfigDecorator(AuthVerifyInterceptor, {
    state: 'authenticated',
    roles,
  });
}

/**
 * Require the controller/route to be unauthenticated
 * @augments `@trv:auth/Unauthenticated`
 */
export function Unauthenticated(): EndpointDecorator {
  return ControllerRegistry.createInterceptorConfigDecorator(AuthVerifyInterceptor, {
    state: 'unauthenticated'
  });
}