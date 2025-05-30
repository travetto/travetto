/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';
import { Session, SessionContext, SessionService } from '@travetto/auth-session';
import { AuthSessionInterceptor } from '@travetto/auth-web-session';
import { ContextParam } from '@travetto/web';

export const text = <>
  <c.StdHeader />
  One of {d.mod('AuthWeb')}'s main responsibility is being able to send, validate and receive authentication/authorization information from the client. <br />

  This module's main responsibilities is to expose {d.mod('AuthSession')}'s data within the scope of an authenticated request flow.

  <c.Code src={AuthSessionInterceptor} title='Anatomy of the Session Interceptor' />

  Once operating within the {Session} boundaries, the session state can be injected via {ContextParam}s, injected as {SessionContext},  or accessed via the {SessionService}.

  <c.Code src='./doc/usage.ts' title='Sample Usage' startRe={/@Authenticated/} />
</>;
