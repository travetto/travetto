import { ContextProvider } from '@travetto/rest/src/decorator/param';

/**
 * Session data, will basically be a key/value map
 */
@ContextProvider((c, req) => req.session.data)
export class SessionDataTarget { }