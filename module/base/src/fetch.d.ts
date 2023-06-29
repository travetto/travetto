/// <reference types='node' />
// @ts-nocheck
import * as stream from 'stream';
import * as http from 'http';

type Callback<T = unknown> = (error: Error | null, val?: T) => void

declare namespace _Fetch {

  type RequestMode = 'cors' | 'no-cors' | 'same-origin';
  type RequestRedirect = 'error' | 'follow' | 'manual';
  type RequestCredentials = 'omit' | 'include' | 'same-origin';
  type RequestCache = 'default' | 'force-cache' | 'no-cache' | 'no-store' | 'only-if-cached' | 'reload';
  type BlobPart = ArrayBuffer | ArrayBufferView | Blob | string;
  type ResponseType = 'basic' | 'cors' | 'default' | 'error' | 'opaque' | 'opaqueredirect';

  interface ReadableStreamReader {
    read(): Promise<{ value?: Uint8Array, done?: boolean }>
  }

  interface ReadableStream {
    getReader(): ReadableStreamReader;
  }

  interface Options {
    writable?: boolean;
    readable?: boolean;
    dataSize?: number;
    maxDataSize?: number;
    pauseStreams?: boolean;
    highWaterMark?: number;
    encoding?: string;
    objectMode?: boolean;
    read?(this: stream.Readable, size: number): void;
    destroy?(this: stream.Readable, error: Error | null, callback: Callback): void;
    autoDestroy?: boolean;
  }

  interface AppendOptions {
    header?: string | Headers;
    knownLength?: number;
    filename?: string;
    filepath?: string;
    contentType?: string;
  }

  class FormData extends stream.Readable {
    constructor(options?: Options);
    append(key: string, value: any, options?: AppendOptions | string): void;
    getHeaders(userHeaders?: Record<string, any>): Record<string, any>;
    submit(params: string | http.RequestOptions, callback?: Callback<http.IncomingMessage>): http.ClientRequest;
    getBuffer(): Buffer;
    setBoundary(boundary: string): void;
    getBoundary(): string;
    getLength(callback: Callback<number>): void;
    getLengthSync(): number;
    hasKnownLength(): boolean;
  }

  class Body {
    constructor(body?: any, opts?: { size?: number; timeout?: number | undefined });
    arrayBuffer(): Promise<ArrayBuffer>;
    blob(): Promise<Blob>;
    formData(): FormData;
    body: ReadableStream;
    bodyUsed: boolean;
    json(): Promise<any>;
    size: number;
    text(): Promise<string>;
    timeout: number;
  }

  class Request extends Body {
    constructor(input: RequestInfo, init?: RequestInit);
    clone(): Request;
    context: string;
    headers: Headers;
    method: string;
    redirect: RequestRedirect;
    referrer: string;
    url: string;
    agent?: http.RequestOptions['agent'] | ((parsedUrl: URL) => http.RequestOptions['agent']);
    compress: boolean;
    counter: number;
    follow: number;
    hostname: string;
    port?: number;
    protocol: string;
    size: number;
    timeout: number;
  }

  type RequestInit = Partial<Pick<Request, 'method' | 'redirect' | 'agent' | 'compress' | 'follow' | 'size' | 'timeout'>> & {
    body?: BodyInit;
    headers?: HeadersInit;
    signal?: AbortSignal | null;
  }

  class Headers extends Map<string, string> {
    constructor(init?: HeadersInit);
    append(name: string, value: string): void;
    raw(): { [k: string]: string[] };
  }

  class File extends Blob {
    constructor(blobParts?: BlobPart[], options?: {
      filename: string;
      type?: string;
      endings?: string;
    });
  }

  interface SystemError extends Error {
    code?: string;
  }

  class FetchError extends Error {
    constructor(message: string, type: string, systemError?: SystemError);
    type: string;
    code?: string;
    errno?: string;
  }

  class Response extends Body {
    constructor(body?: BodyInit, init?: ResponseInit);
    static error(): Response;
    static redirect(url: string, status: number): Response;
    clone(): Response;
    headers: Headers;
    ok: boolean;
    redirected: boolean;
    status: number;
    statusText: string;
    type: ResponseType;
    url: string;
  }

  interface ResponseInit {
    headers?: HeadersInit;
    size?: number;
    status?: number;
    statusText?: string;
    timeout?: number;
    url?: string;
  }

  type HeadersInit = Headers | string[][] | { [key: string]: string };
  type BodyInit = ArrayBuffer | ArrayBufferView | NodeJS.ReadableStream | string | URLSearchParams | FormData;
  type RequestInfo = string | { href: string } | Request;

  function fetch(url: RequestInfo, init?: RequestInit): Promise<Response>;

  namespace fetch {
    function isRedirect(code: number): boolean;
  }
}

declare global {
  export const { FormData, Headers, Response, Request, File, fetch }: typeof _Fetch;
  type FormData = _Fetch.FormData;
  type Headers = _Fetch.Headers;
  type Request = _Fetch.Request;
  type Response = _Fetch.Response;
  type BodyInit = _Fetch.BodyInit;
  type RequestInit = _Fetch.RequestInit;
  type File = _Fetch.File;
}