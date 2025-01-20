import { PrincipalTarget } from '@travetto/auth/src/internal/types';
import { ContextProvider, ParamExtractor } from '@travetto/rest';

export const LoginContextSymbol = Symbol.for('@travetto/auth-rest:login');

/**
 * @augments `@travetto/rest:Context`
 */
@ContextProvider((_, req) => req[LoginContextSymbol])
export class LoginContextTarget { }

export class PrincipalEncoderTarget { }

// Register context providers
ParamExtractor.registerContext(PrincipalTarget, (_, r) => r.auth);
