import { BinaryUtil, ErrorCategory, Util } from '@travetto/runtime';
import { Readable } from 'node:stream';

type ErrorResponse = Error & { category?: ErrorCategory, status?: number, statusCode?: number };


/**
 * Mapping from error category to standard http error codes
 */
const ERROR_CATEGORY_STATUS: Record<ErrorCategory, number> = {
  general: 500,
  notfound: 404,
  data: 400,
  permissions: 403,
  authentication: 401,
  timeout: 408,
  unavailable: 503,
};

export class WebBodyUtil {

  static getErrorStatus(e: Error): number {
    const error: ErrorResponse = e;
    return error.status ?? error.statusCode ?? ERROR_CATEGORY_STATUS[error.category!] ?? 500;
  }

  /**
   * Generate multipart body
   */
  static buildMultiPartBody(form: FormData): [string, Readable] {
    const boundary = `-------------------------multipart-${Util.uuid()}`;
    async function* source(): AsyncIterable<string | Buffer> {
      const nl = '\r\n';
      for (const [k, v] of form.entries()) {
        const data = v.slice();
        const filename = data instanceof File ? data.name : undefined;
        const size = data instanceof Blob ? data.size : data.length;
        const type = data instanceof Blob ? data.type : undefined;
        yield `--${boundary}${nl}`;
        yield `Content-Disposition: form-data; name="${k}"; filename="${filename ?? k}"${nl}`;
        yield `Content-Length: ${size}${nl}`;
        if (type) {
          yield `Content-Type: ${type}${nl}`;
        }
        yield nl;
        if (data instanceof Blob) {
          for await (const chunk of data.stream()) {
            yield chunk;
          }
        } else {
          yield data;
        }
        yield nl;
      }
      yield `--${boundary}--${nl}`;
    }
    return [boundary, Readable.from(source())];
  }

  /** Get Blob Headers */
  static getBlobHeaders(value: Blob): Record<string, string> {
    const meta = BinaryUtil.getBlobMeta(value);

    const toAdd: [string, string | undefined][] = [
      ['Content-Length', `${value.size}`],
      ['Content-Encoding', meta?.contentEncoding],
      ['Cache-Control', meta?.cacheControl],
      ['Content-Language', meta?.contentLanguage],
    ];

    if (meta?.range) {
      toAdd.push(
        ['Accept-Ranges', 'bytes'],
        ['Content-range', `bytes ${meta.range.start}-${meta.range.end}/${meta.size}`],
      );
    }

    if (value instanceof File && value.name) {
      toAdd.push(['Content-disposition', `attachment; filename="${value.name}"`]);
    }

    return Object.fromEntries(toAdd.filter((x): x is [string, string] => !!x[1]));
  }

  /**
   * Build WebResponse based on return value
   */
  static defaultContentType(value: unknown): string {
    if (value === undefined || value === null) {
      return '';
    } else if (typeof value === 'string') {
      return 'text/plain';
    } else if (BinaryUtil.isBinaryType(value)) {
      return 'application/octet-stream';
    } else if (value instanceof FormData) {
      return 'multipart/form-data';
    } else {
      return 'application/json';
    }
  }
}