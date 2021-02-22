import { SetOption, GetOption } from 'cookies';
import type { IncomingMessage, ServerResponse, IncomingHttpHeaders } from 'http';
import { HeaderMap } from './types';
import { HeadersAddedSym, NodeEntitySym, ProviderEntitySym } from './internal/symbol';

declare global {
  /**
   * Travetto request
   * @concrete ./internal/types:RequestTarget
   */
  interface TravettoRequest<T = unknown> {
    /**
     * The original request of the underlying framework
     */
    [ProviderEntitySym]?: T;
    /**
     * The raw http Incoming Message object
     */
    [NodeEntitySym]: IncomingMessage;
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
     * The request's base url
     */
    baseUrl?: string;
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
    headers: IncomingHttpHeaders;
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
     * The stream to pipe the request to.  Useful for file uploads.
     * @param stream 
     */
    pipe(stream: NodeJS.WritableStream): any;
    /**
     * Get a header as a string or array of strings depending on what was passed
     * @param key 
     */
    header(key: string): string | string[] | undefined;
    /**
     * Listen for request events
     */
    on(ev: 'end' | 'close' | 'error', cb: Function): any;
  }

  /**
   * Travetto response
   * @concrete ./internal/types:ResponseTarget
   */
  interface TravettoResponse<T = unknown> {
    /**
     * The underlying request object
     */
    [ProviderEntitySym]?: T;
    /**
     * The raw http server response object
     */
    [NodeEntitySym]: ServerResponse;
    /**
     * The additional headers for this request, provided by controllers/route config
     */
    [HeadersAddedSym]?: HeaderMap;
    /**
     * Outbound status code
     */
    statusCode: number;
    /**
     * Set the status code
     * @param code The code to set
     */
    status(code?: number): (number | undefined);
    /**
     * Indicates if headers have already been sent
     */
    headersSent: boolean;
    /**
     * Get the headers that have been marked for sending
     * @param key Header name
     */
    getHeader(key: string): string;
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
    on(ev: 'close' | 'finish', cb: Function): any;

    /**
     * Redirect the request to a new location
     * @param path The new location
     */
    redirect(path: string): any;
    /**
     * Redirect the request to a new location
     * @param code The status code for redirect
     * @param path The new location
     */
    redirect(code: number, path: string): any;
    redirect(code: number | string, path?: string): any;

    /**
     * Set the request's location
     * @param path The location to point to
     */
    location(path: string): any;

    /**
     * Return a value as JSON
     * @param value Value to serialize as JSON
     */
    json(value: any): any;
    /**
     * Send a value to the client
     * @param value Value to send
     */
    send(value: any): any;
    /**
     * Write content directly to the output stream
     * @param value The value to write
     */
    write(value: any): any;
    /**
     * End the response, with a final optional value
     * @param val 
     */
    end(val?: any): any;
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