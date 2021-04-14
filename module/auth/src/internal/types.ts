import { ContextProvider } from '@travetto/rest';

@ContextProvider((c, req) => req.auth)
export class PrincipalTarget { }

export class AuthorizerTarget { }
export class AuthenticatorTarget { }