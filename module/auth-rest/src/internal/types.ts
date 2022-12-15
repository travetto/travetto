import { PrincipalTarget } from '@travetto/auth/src/internal/types';
import { ContextProvider, ParamExtractor } from '@travetto/rest';

export const LoginContextⲐ = Symbol.for('@trv:auth-rest/login');

/**
 * @augments `@trv:rest/Context`
 */
@ContextProvider((_, req) => req[LoginContextⲐ])
export class LoginContextTarget { }

export class PrincipalEncoderTarget { }


// Register context providers
ParamExtractor.registerContext(PrincipalTarget, (_, r) => r.auth);
