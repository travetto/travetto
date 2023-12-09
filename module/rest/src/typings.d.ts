import { SetOption, GetOption } from 'cookies';
import type { IncomingMessage, ServerResponse, IncomingHttpHeaders } from 'node:http';
import { Readable, Writable } from 'node:stream';

import { ContentType, HeaderMap } from './types';
import { HeadersAddedⲐ, InterceptorConfigsⲐ, NodeEntityⲐ, ProviderEntityⲐ, SendStreamⲐ } from './internal/symbol';

declare global {
  /**
   * Extension point for supporting new request headers
   */
  interface TravettoRequestHeaders extends IncomingHttpHeaders {
  }

  /**
   * Travetto request
   * @concrete ./internal/types:RequestTarget
   * @augments `@travetto/rest:Context`
   */
  interface TravettoRequest<T = unknown> {
    /**
     * The original request of the underlying framework
     */
    [ProviderEntityⲐ]?: T;
    /**
     * The raw http Incoming Message object
     */
    [NodeEntityⲐ]: IncomingMessage;
    /**
     * Interceptor-related configs, providing request-awareness of route-level configurations
     */
    [InterceptorConfigsⲐ]?: Record<string, Record<string, unknown>>;
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
    query: Record<string, any>;
    /**
     * The path parameters
     */
    params: Record<string, any>;
    /**
     * The request headers
     */
    headers: TravettoRequestHeaders;
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
    body: any;
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
    header<K extends keyof TravettoRequestHeaders>(key: K): TravettoRequestHeaders[K] | undefined;
    /**
     * Get a header as a list of values
     * @param key 
     */
    headerList<K extends keyof TravettoRequestHeaders>(key: K): string[] | undefined;
    /**
     * Get a single header
     * @param key 
     */
    headerFirst<K extends keyof TravettoRequestHeaders>(key: K): string | undefined;
    /**
     * Get the structured content type of the request
     */
    getContentType(): ContentType | undefined;
    /**
     * Listen for request events
     */
    on(ev: 'end' | 'close' | 'error', cb: Function): unknown;
    /**
     * Get the ip address for a request
     */
    getIp(): string | undefined;
  }

  /**
   * Travetto response
   * @concrete ./internal/types:ResponseTarget
   * @augments `@travetto/rest:Context`
   */
  interface TravettoResponse<T = unknown> {
    /**
     * The underlying request object
     */
    [ProviderEntityⲐ]?: T;
    /**
     * The raw http server response object
     */
    [NodeEntityⲐ]: ServerResponse;
    /**
     * The additional headers for this request, provided by controllers/route config
     */
    [HeadersAddedⲐ]?: HeaderMap;
    /**
     * Outbound status code
     */
    statusCode: number;
    /**
     * The error that caused the current status
     */
    statusError?: Error;
    /**
     * Set the status code
     * @param code The code to set
     */
    status(code?: number): (number | undefined);
    /**
     * Indicates if headers have already been sent
     */
    readonly headersSent: boolean;
    /**
     * Get the headers that have been marked for sending
     * @param key Header name
     */
    getHeader(key: string): string | string[] | undefined;
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
     * Listen for response events
     * @param ev Name of the event
     * @param cb The callback for the event
     */
    on(ev: 'close' | 'finish', cb: Function): unknown;

    /**
     * Redirect the request to a new location
     * @param path The new location
     */
    redirect(path: string): unknown;
    /**
     * Redirect the request to a new location
     * @param code The status code for redirect
     * @param path The new location
     */
    redirect(code: number, path: string): unknown;
    redirect(code: number | string, path?: string): unknown;

    /**
     * Set the request's location
     * @param path The location to point to
     */
    location(path: string): unknown;
    /**
     * Send a value to the client
     * @param value Value to send
     */
    send(value: any): unknown;
    /**
     * Optional internal method for sending streams
     * @param stream
     */
    [SendStreamⲐ]?(stream: Readable): Promise<void>;
    /**
     * Write content directly to the output stream
     * @param value The value to write
     */
    write(value: unknown): unknown;
    /**
     * End the response, with a final optional value
     * @param val
     */
    end(val?: unknown): unknown;
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
      set(name: string, value?: any, options?: SetOption): void;
    };
  }
}