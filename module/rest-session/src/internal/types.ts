import { ContextProvider } from '@travetto/rest/src/decorator/param';

/**
 * Symbol for accessing the raw session
 */
export const TRV_SESSION = Symbol.for('@trv:rest-session/self');

export class SessionEncoderTarget { }

/**
 * Session data, will basically be a key/value map
 */
@ContextProvider((c, req) => req.session.data)
export class SessionDataTarget { }