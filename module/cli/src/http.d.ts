import { URL } from 'url';
import { IncomingMessage } from 'http';

export interface HttpHandler {
  onChange?(cb: () => void): void;
  resolve(message: IncomingMessage): Promise<{ content: string | Buffer, contentType?: string }>;
}

export function Server(handler: HttpHandler, port?: number): void;