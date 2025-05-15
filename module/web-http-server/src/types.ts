export type WebSecureKeyPair = { cert: string, key: string };

export type WebHttpServerHandle = { wait: Promise<void>, kill: () => void };

/**
 * Defines the shape of the web server
 *
 * @concrete
 */
export interface WebHttpServer {
  serve(): Promise<WebHttpServerHandle>;
}