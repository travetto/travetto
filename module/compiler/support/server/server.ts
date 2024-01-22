import http from 'node:http';
import timers from 'node:timers/promises';
import fs from 'node:fs/promises';
import path from 'node:path';

import type { ManifestContext } from '@travetto/manifest';

import type { CompilerMode, CompilerOp, CompilerProgressEvent, CompilerEvent, CompilerEventType, CompilerServerInfo } from '../types';
import { LogUtil } from '../log';
import { CompilerClient } from './client';
import { CommonUtil } from '../util';

const log = LogUtil.scoped('compiler-server');

/**
 * Compiler Server Class
 */
export class CompilerServer {

  static readJSONRequest<T>(req: http.IncomingMessage): Promise<T> {
    return new Promise<T>((res, rej) => {
      const body: Buffer[] = [];
      req.on('data', (chunk) => body.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk));
      req.on('end', () => {
        try {
          res(JSON.parse(Buffer.concat(body).toString('utf8')));
        } catch (err) {
          rej(err);
        }
      });
      req.on('error', rej);
    });
  }

  #ctx: ManifestContext;
  #server: http.Server;
  #listeners: { res: http.ServerResponse, type: CompilerEventType }[] = [];
  #shutdown = new AbortController();
  signal = this.#shutdown.signal;
  info: CompilerServerInfo;
  #client: CompilerClient;
  #url: string;

  constructor(ctx: ManifestContext, op: CompilerOp) {
    this.#ctx = ctx;
    this.#client = new CompilerClient(ctx, LogUtil.scoped('client.server'));
    this.#url = this.#client.url;
    this.info = {
      state: 'startup',
      iteration: Date.now(),
      mode: op === 'run' ? 'build' : op,
      serverPid: process.pid,
      compilerPid: -1,
      path: ctx.workspace.path,
      url: this.#url
    };

    this.#server = http.createServer({
      keepAlive: true,
      requestTimeout: 1000 * 60 * 60,
      keepAliveTimeout: 1000 * 60 * 60,
    }, (req, res) => this.#onRequest(req, res));

    process.once('exit', () => this.#shutdown.abort());
  }

  get mode(): CompilerMode {
    return this.info.mode;
  }

  isResetEvent(ev: CompilerEvent): boolean {
    return ev.type === 'state' && ev.payload.state === 'reset';
  }

  async #tryListen(attempt = 0): Promise<'ok' | 'running'> {
    const output = await new Promise<'ok' | 'running' | 'retry'>((resolve, reject) => {
      this.#server
        .on('listening', () => resolve('ok'))
        .on('error', async err => {
          if ('code' in err && err.code === 'EADDRINUSE') {
            const info = await this.#client.info();
            resolve((info && info.mode === 'build' && this.mode === 'watch') ? 'retry' : 'running');
          } else {
            log('warn', 'Failed in running server', err);
            reject(err);
          }
        })
        .on('close', () => log('debug', 'Server close event'));

      const url = new URL(this.#url);
      setTimeout(() => this.#server.listen(+url.port, url.hostname), 1); // Run async
    });

    if (output === 'retry') {
      if (attempt >= 5) {
        throw new Error('Unable to verify compilation server');
      }
      log('info', 'Waiting for build to finish, before retrying');
      // Let the server finish
      await this.#client.waitForState(['close'], 'Server closed', this.signal);
      return this.#tryListen(attempt + 1);
    }

    return output;
  }

  async #addListener(type: string, res: http.ServerResponse): Promise<void> {
    res.writeHead(200);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    this.#listeners.push({ res, type: type as 'change' });
    await new Promise(resolve => res.on('close', resolve));
    this.#listeners.splice(this.#listeners.findIndex(x => x.res === res), 1);
    res.end();
  }

  #emitEvent(ev: CompilerEvent): void {
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

  async #clean(): Promise<{ clean: boolean }> {
    await Promise.all([this.#ctx.build.compilerFolder, this.#ctx.build.outputFolder]
      .map(f => fs.rm(path.resolve(this.#ctx.workspace.path, f), { recursive: true, force: true })));
    return { clean: true };
  }

  /**
   * Request handler
   */
  async #onRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    res.setHeader('Content-Type', 'application/json');

    const [, action, subAction] = new URL(`${this.#url}${req.url}`).pathname.split('/');

    log('debug', 'Receive request', { action, subAction });

    let out: unknown;
    switch (action) {
      case 'send-event': await this.#emitEvent(await CompilerServer.readJSONRequest(req)); out = { received: true }; break;
      case 'event': return await this.#addListener(subAction, res);
      case 'stop': out = await this.close(true); break;
      case 'clean': out = await this.#clean(); break;
      case 'info':
      default: out = this.info ?? {}; break;
    }
    res.end(JSON.stringify(out));
  }

  /**
   * Process events
   */
  async processEvents(src: (signal: AbortSignal) => AsyncIterable<CompilerEvent>): Promise<void> {

    LogUtil.log('compiler', 'debug', 'Started, streaming logs');
    LogUtil.consumeLogEvents(this.#client.fetchEvents('log', { signal: this.signal }));

    for await (const ev of CommonUtil.restartableEvents(src, this.signal, this.isResetEvent)) {
      if (ev.type === 'progress') {
        await LogUtil.logProgress?.(ev.payload);
      }

      this.#emitEvent(ev);

      if (ev.type === 'state') {
        this.info.state = ev.payload.state;
        if (ev.payload.state === 'init' && ev.payload.extra && 'pid' in ev.payload.extra && typeof ev.payload.extra.pid === 'number') {
          this.info.compilerPid = ev.payload.extra.pid;
        }
        log('info', `State changed: ${this.info.state}`);
      }
      if (this.isResetEvent(ev)) {
        await this.#disconnectActive();
      }
    }

    // Terminate, after letting all remaining events emit
    await this.close(this.signal.aborted);
  }

  /**
   * Close server
   */
  async close(force: boolean): Promise<unknown> {
    log('info', 'Closing down server');
    const shutdown = new Promise(r => {

      if (force) {
        const cancel: CompilerProgressEvent = { complete: true, idx: 0, total: 0, message: 'Complete', operation: 'compile' };
        LogUtil.logProgress?.(cancel);
        this.#emitEvent({ type: 'progress', payload: cancel });
      }

      this.#server.close(r);
      this.#emitEvent({ type: 'state', payload: { state: 'close' } });
      this.#server.unref();
      setImmediate(() => {
        this.#server.closeAllConnections();
        this.#shutdown.abort();
      });
    });

    await Promise.race([shutdown, timers.setTimeout(1000)]);

    return { closing: true };
  }

  /**
   * Start the server listening
   */
  async listen(): Promise<CompilerServer | undefined> {
    const running = await this.#tryListen() === 'ok';
    log('info', running ? 'Starting server' : 'Server already running under a different process', this.#url);
    return running ? this : undefined;
  }
}