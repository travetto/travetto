import type { IncomingMessage, ServerResponse, IncomingHttpHeaders } from 'node:http';
import { Readable, Writable } from 'node:stream';

import { SetOption, GetOption } from 'cookies';

import type { ByteRange, Any } from '@travetto/runtime';

export type HttpContext<C = {}> = { req: HttpRequest, res: HttpResponse } & C;
export type HttpFilter<C extends HttpContext = HttpContext> = (context: C) => unknown;
export type HttpHeaderMap = Record<string, (string | (() => string))>;
export type HttpMethodOrAll = 'get' | 'post' | 'put' | 'delete' | 'patch' | 'head' | 'options' | 'all';
export type MimeType = { type: string, subtype: string, full: string, parameters: Record<string, string> };

export type HttpChainedContext<C = unknown> = HttpContext<{ next: () => unknown, config: C }>;
export type HttpChainedFilter<C = unknown> = HttpFilter<HttpChainedContext<C>>;

export const WebInternal: unique symbol = Symbol.for('@travetto/web:internal');

/**
 * Extension point for supporting new request headers
 */
export interface RequestHeaders extends IncomingHttpHeaders { }

/**
 * Internal request information
 */
export interface HttpRequestInternal<T = unknown> {
  /**
   * The created timestamp of the request object
   */
  createdDate?: number;
  /**
   * The parsed params for the target handler
   */
  requestParams?: unknown[];
  /**
   * The original request of the underlying framework
   */
  providerEntity: T;
  /**
   * The raw http Incoming Message object
   */
  nodeEntity: IncomingMessage;
  /**
   * Interceptor-related configs, providing request-awareness of endpoint-level configurations
   */
  interceptorConfigs?: Record<string, Record<string, unknown>>;
  /**
   * Expanded representation of query
   */
  queryExpanded?: Record<string, unknown>;
  /**
   * Expanded representation of query
   */
  parsedType?: MimeType;
}

/**
 * Travetto request
 * @concrete
 */
export interface HttpRequest<T = unknown> {
  /**
   * Internal state for the request
   */
  [WebInternal]: HttpRequestInternal<T>;
  /**
   * The http method
   */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS' | 'TRACE';
  /**
   * The path of the request
   */
  path: string;
  /**
   * The full request URL
   */
  url: string;
  /**
   * The http protocol
   */
  protocol: 'http' | 'https';
  /**
   * The query parameters
   */
  query: Record<string, Any>;
  /**
   * The path parameters
   */
  params: Record<string, Any>;
  /**
   * The request headers
   */
  headers: RequestHeaders;
  /**
   * The cookie support
   */
  cookies: {
    /**
     * Get a cookie by name, with options
     * @param name The name of the cookie to retrieve
     * @param options The options for cookie retrieval
     */
    get(name: string, options?: GetOption): string | undefined;
  };
  /**
   * The http request body
   */
  body: Any;
  /**
   * Raw body as a buffer, if applicable
   */
  raw?: Buffer;
  /**
   * The stream to pipe the request to.  Useful for file uploads.
   * @param stream
   */
  pipe(stream: Writable): unknown;
  /**
   * Get a header as a string or array of strings depending on what was passed
   * @param key
   */
  header<K extends keyof RequestHeaders>(key: K): RequestHeaders[K] | undefined;
  /**
   * Get a header as a list of values
   * @param key
   */
  headerList<K extends keyof RequestHeaders>(key: K): string[] | undefined;
  /**
   * Get a single header
   * @param key
   */
  headerFirst<K extends keyof RequestHeaders>(key: K): string | undefined;
  /**
   * Get the structured content type of the request
   */
  getContentType(): MimeType | undefined;
  /**
   * Get the ip address for a request
   */
  getIp(): string | undefined;
  /**
   * Get requested range
   */
  getRange(chunkSize?: number): ByteRange | undefined;
  /**
   * Read the file name from the request content disposition
   */
  getFilename(): string | undefined;
  /**
   * Get expanded query
   */
  getExpandedQuery(): Record<string, unknown>;
}

/**
 * Internal response information
 */
export interface HttpResponseInternal<T = unknown> {
  /**
   * The underlying request object
   */
  providerEntity: T;
  /**
   * The raw http server response object
   */
  nodeEntity: ServerResponse;
  /**
   * The additional headers for this request, provided by controllers/endpoint config
   */
  headersAdded?: HttpHeaderMap;
  /**
   * Disable operations
   */
  takeControlOfResponse?: Function;
  /**
   * The currently produced payload
   */
  payload?: [result: HttpPayload, source: unknown];
}

/**
 * Travetto response
 * @concrete
 */
export interface HttpResponse<T = unknown> {
  /**
   * Internal state for the response
   */
  [WebInternal]: HttpResponseInternal<T>;
  /**
   * Outbound status code
   */
  statusCode?: number;
  /**
   * Indicates if headers have already been sent
   */
  readonly headersSent: boolean;
  /**
   * Get a registered response header by name
   * @param key Header name
   */
  getHeader(key: string): string | string[] | undefined;
  /**
   * Get the headers that have been marked for sending
   * @param key Header name
   */
  getHeaderNames(): string[];
  /**
   * Set a header to be sent.  Fails if headers have already been sent.
   * @param key The header to set
   * @param value The header value as a single or list of values
   */
  setHeader(key: string, value: string | string[]): void;
  /**
   * Remove a header from being sent.  Fails if headers have already been set.
   * @param key The header key to remove
   */
  removeHeader(key: string): void;
  /**
   * Add value to vary header, or create if not existing
   */
  vary(value: string): void;
  /**
   * Trigger response
   */
  respond(value: Buffer | Readable): Promise<unknown> | unknown;
  /**
   * Cookie support for sending to the client
   */
  cookies: {
    /**
     * Set a cookie to send back to the client
     * @param name Name of the cookie
     * @param value The cookie value
     * @param options Cookie options to set
     */
    set(name: string, value?: string, options?: SetOption): void;
  };
}

export interface HttpPayload {
  headers?: Record<string, string>;
  defaultContentType?: string;
  statusCode?: number;
  data: Buffer | Readable;
  length?: number;
};