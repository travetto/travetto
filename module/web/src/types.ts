import type { IncomingHttpHeaders } from 'node:http';
import { Readable, Writable } from 'node:stream';

import { GetOption } from 'cookies';

import type { ByteRange, Any } from '@travetto/runtime';
import { HttpPayload } from './response/payload';

export type HttpContext<C = {}> = { req: HttpRequest } & C;
export type HttpFilter<C extends HttpContext = HttpContext> = (context: C) => Promise<HttpPayload>;
export type HttpMethodOrAll = 'get' | 'post' | 'put' | 'delete' | 'patch' | 'head' | 'options' | 'all';
export type HttpHeaderMap = Record<string, string | string[] | (() => string)>;
export type MimeType = { type: string, subtype: string, full: string, parameters: Record<string, string> };
export type HttpMetadataConfig = { mode?: 'header' | 'cookie', header: string, cookie: string, headerPrefix?: string };


export type HttpChainedContext<C = unknown> = HttpContext<{ next: () => Promise<HttpPayload>, config: C }>;
export type HttpChainedFilter<C = unknown> = HttpFilter<HttpChainedContext<C>>;

export const WebInternal: unique symbol = Symbol.for('@travetto/web:internal');

/**
 * Extension point for supporting new request headers
 */
export interface RequestHeaders extends IncomingHttpHeaders { }

export interface HttpContact<T = unknown, U = unknown> {
  /**
   * The original request of the underlying framework
   */
  providerReq: T;
  /**
   * The original response of the underlying framework
   */
  providerRes: U;
  /**
   * The raw http input stream
   */
  inputStream: Readable;
  /**
   * Triggers response to provider entity
   */
  respond(value: HttpPayload): unknown;
}

/**
 * Internal request information
 */
export interface HttpRequestInternal<T = unknown> {
  /**
   * The parsed params for the target handler
   */
  requestParams?: unknown[];
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
  /**
   * The communications channel
   */
  contact: HttpContact;
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
  getHeader<K extends keyof RequestHeaders>(key: K): RequestHeaders[K] | undefined;
  /**
   * Get a header as a list of values
   * @param key
   */
  getHeaderList<K extends keyof RequestHeaders>(key: K): string[] | undefined;
  /**
   * Get a single header
   * @param key
   */
  getHeaderFirst<K extends keyof RequestHeaders>(key: K): string | undefined;
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
  /**
   * Get a cookie by name, with options
   * @param name The name of the cookie to retrieve
   * @param options The options for cookie retrieval
   */
  getCookie(name: string, options?: GetOption): string | undefined;

  /**
   * Read value from request
   */
  readMetadata(cfg: HttpMetadataConfig, opts?: GetOption): string | undefined;
}