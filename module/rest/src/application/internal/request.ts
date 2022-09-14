import { IncomingHttpHeaders } from 'http';

import { Request, ContentType } from '../../types';
import { MimeUtil } from '../../util/mime';

const ParsedType = Symbol.for('@trv:rest/content-type');

/**
 * Base Request object
 */
export class RequestCore implements Partial<Request> {
  /**
   * Content type parsed
   */
  [ParsedType]?: ContentType;

  /**
   * Get the inbound request header as a string
   * @param key The header to get
   */
  header<K extends keyof IncomingHttpHeaders>(this: Request, key: K): string | undefined {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return this.headers[(key as string).toLowerCase() as K] as string | undefined;
  }
  /**
   * Get the inbound request header as a string[]
   * @param key The header to get
   */
  headerList<K extends keyof IncomingHttpHeaders>(this: Request, key: K): string[] | undefined {
    const res = this.header(key);
    if (res === undefined) {
      return res;
    }
    return typeof res === 'string' ?
      res.split(
        /set-cookie/i.test(key.toString()) ?
          /\s*;\s*/ : /\s*,\s*/
      ) : res;
  }

  /**
   * Get the inbound request header first value
   * @param key The header to get
   */
  headerFirst<K extends keyof IncomingHttpHeaders>(this: Request, key: K): string | undefined {
    return this.headerList(key)?.[0];
  }

  /**
   * Get the fully parsed content type
   */
  getContentType(this: Request): ContentType | undefined {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const self = (this as RequestCore);
    return self[ParsedType] ??= MimeUtil.parse(this.headerFirst('content-type'));
  }
}
