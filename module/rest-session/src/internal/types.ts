import { ContextProvider } from '@travetto/rest/src/decorator/param';

/**
 * Symbol for accessing the raw session
 */
export const SessionSym = Symbol.for('@trv:rest-session/self');

/**
 * Session data, will basically be a key/value map
 */
@ContextProvider((c, req) => req.session.data)
export class SessionDataTarget { }