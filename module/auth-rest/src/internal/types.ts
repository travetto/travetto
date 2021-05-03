import { PrincipalTarget } from '@travetto/auth/src/internal/types';
import { ContextProvider, ParamUtil } from '@travetto/rest';

export const LoginContextⲐ = Symbol.for('@trv:auth-rest/login');

@ContextProvider((_, req) => req[LoginContextⲐ])
export class LoginContextTarget { }

export class PrincipalEncoderTarget { }


// Register context providers
ParamUtil.registerContext(PrincipalTarget, (_, r) => r.auth);
