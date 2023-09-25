import http from 'http';

import type { ManifestContext } from '@travetto/manifest';

import type { BuildOp, CompilerServerEvent, CompilerServerEventType, CompilerServerInfo } from '../types';
import { LogUtil } from '../log';
import { CompilerClientUtil } from './client';
import { CommonUtil } from '../util';

const log = LogUtil.log.bind(LogUtil, 'compiler-server');

/**
 * Compiler Server Class
 */
export class CompilerServer {

  #ctx: ManifestContext;
  #server: http.Server;
  #listeners: { res: http.ServerResponse, type: CompilerServerEventType }[] = [];
  #shutdown = new AbortController();
  signal = this.#shutdown.signal;
  info: CompilerServerInfo;

  constructor(ctx: ManifestContext, op: BuildOp) {
    this.#ctx = ctx;
    this.info = {
      state: 'startup',
      iteration: Date.now(),
      type: op,
      path: ctx.workspacePath
    };

    this.#server = http.createServer({
      keepAlive: true,
      requestTimeout: 1000 * 60 * 60,
      keepAliveTimeout: 1000 * 60 * 60,
    }, (req, res) => this.#onRequest(req, res));

    // Connect
    process.on('SIGINT', () => this.#shutdown.abort());
  }

  get op(): BuildOp {
    return this.info.type;
  }

  isResetEvent(ev: CompilerServerEvent): boolean {
    return ev.type === 'state' && ev.payload.state === 'reset';
  }

  async #tryListen(attempt = 0): Promise<'ok' | 'running'> {
    const output = await new Promise<'ok' | 'running' | 'retry'>((resolve, reject) => {
      this.#server
        .on('listening', () => resolve('ok'))
        .on('error', async err => {
          if ('code' in err && err.code === 'EADDRINUSE') {
            const info = await CompilerClientUtil.getServerInfo(this.#ctx);
            resolve((info && info.type === 'build' && this.op === 'watch') ? 'retry' : 'running');
          } else {
            reject(err);
          }
        });

      const url = new URL(this.#ctx.compilerUrl);
      setTimeout(() => this.#server.listen(+url.port, url.hostname), 1); // Run async
    });

    if (output === 'retry') {
      if (attempt >= 5) {
        throw new Error('Unable to verify compilation server');
      }
      log('info', 'Waiting for build to finish, before retrying');
      // Let the server finish
      await CompilerClientUtil.waitForState(this.#ctx, ['close'], this.signal);
      return this.#tryListen(attempt + 1);
    }

    return output;
  }

  async #addListener(type: CompilerServerEventType, res: http.ServerResponse): Promise<void> {
    res.writeHead(200);
    this.#listeners.push({ res, type });
    await new Promise(resolve => res.on('close', resolve));
    this.#listeners.splice(this.#listeners.findIndex(x => x.res === res), 1);
    res.end();
  }

  #emitEvent(ev: CompilerServerEvent): void {
    const msg = `${JSON.stringify(ev.payload)}\n`;
    for (const el of this.#listeners) {
      if (!el.res.closed && el.type === ev.type) {
        el.res.write(msg);
      }
    }
  }

  async #disconnectActive(): Promise<void> {
    log('info', 'Server disconnect requested');
    this.info.iteration = Date.now();
    await new Promise(r => setTimeout(r, 20));
    this.#server.closeAllConnections(); // Force reconnects
  }

  /**
   * Request handler
   */
  async #onRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    res.setHeader('Content-Type', 'application/json');

    const urlPath = (req.url ?? '/')?.split(/[?#]/)[0].replace(/^[/]/, '');
    if (urlPath.startsWith('event/')) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return await this.#addListener(urlPath.split('event/')[1] as 'change', res);
    }

    log('debug', `Receive request ${urlPath}`);

    let out: unknown;
    switch (urlPath) {
      case 'close': return this.close();
      case 'info': out = this.info ?? {}; break;
      default: out = { error: 'Unknown request' }; res.statusCode = 404; break;
    }
    res.write(JSON.stringify(out));
    res.end();
  }

  /**
   * Process events
   */
  async processEvents(src: (signal: AbortSignal) => AsyncIterable<CompilerServerEvent>): Promise<void> {

    CompilerClientUtil.streamLogs(this.#ctx, this.signal); // Send logs to stdout

    for await (const ev of CommonUtil.restartableEvents(src, this.signal, this.isResetEvent)) {
      this.#emitEvent(ev);

      if (ev.type === 'state') {
        this.info.state = ev.payload.state;
        log('info', `State changed: ${this.info.state}`);
      }
      if (this.isResetEvent(ev)) {
        await this.#disconnectActive();
      }
    }

    // Terminate, after letting all remaining events emit
    setImmediate(() => this.close());
  }

  /**
   * Close server
   */
  async close(): Promise<void> {
    log('info', 'Closing down server');
    this.#shutdown.abort();
    this.#emitEvent({ type: 'state', payload: { state: 'close' } });
    this.#server.unref();
    await new Promise(r => {
      this.#server.close(r);
      setImmediate(() => this.#server.closeAllConnections());
    });
  }

  /**
   * Start the server listening
   */
  async listen(): Promise<CompilerServer | undefined> {
    const running = await this.#tryListen() === 'ok';
    log('info', running ? 'Starting server' : 'Server already running under a different process', this.#ctx.compilerUrl);
    return running ? this : undefined;
  }
}