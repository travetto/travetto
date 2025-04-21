/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';
import { Session, SessionContext, SessionService } from '@travetto/auth-session';
import { AuthSessionInterceptor } from '@travetto/auth-web-session';
import { ContextParam } from '@travetto/web';

export const text = <>
  <c.StdHeader />
  One of {d.mod('AuthWeb')}'s main responsibilities is being able to send and receive authentication/authorization information from the client. <br />

  This module's main responsibilities is to expose {d.mod('AuthSession')}'s data within the scope of the request/response flow.

  <c.Code src={AuthSessionInterceptor} title='Anatomy of the Session Interceptor' startRe={/WebSessionConfig/} />

  Once operating within the {Session} boundaries, the session state can be injected via {ContextParam}s, injected as {SessionContext},  or accessed via the {SessionService}.

  <c.Code src='./doc/usage.ts' title='Sample Usage' startRe={/@Authenticated/} />
</>;
