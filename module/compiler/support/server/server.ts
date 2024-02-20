import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { setMaxListeners } from 'node:events';

import type { ManifestContext } from '@travetto/manifest';

import type { CompilerMode, CompilerProgressEvent, CompilerEvent, CompilerEventType, CompilerServerInfo } from '../types';
import { Log } from '../log';
import { CommonUtil } from '../util';
import { CompilerClient } from './client';
import { ProcessHandle } from './process-handle';

const log = Log.scoped('server');

/**
 * Compiler Server Class
 */
export class CompilerServer {

  #ctx: ManifestContext;
  #server: http.Server;
  #listeners: Record<string, { res: http.ServerResponse, type: CompilerEventType }> = {};
  #shutdown = new AbortController();
  signal = this.#shutdown.signal;
  info: CompilerServerInfo;
  #client: CompilerClient;
  #url: string;
  #handle: Record<'compiler' | 'server', ProcessHandle>;

  constructor(ctx: ManifestContext, mode: CompilerMode) {
    this.#ctx = ctx;
    this.#client = new CompilerClient(ctx, Log.scoped('server.client'));
    this.#url = this.#client.url;
    this.#handle = { server: new ProcessHandle(ctx, 'server'), compiler: new ProcessHandle(ctx, 'compiler') };

    this.info = {
      state: 'startup',
      iteration: Date.now(),
      mode,
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

    setMaxListeners(1000, this.signal);
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
            log.warn('Failed in running server', err);
            reject(err);
          }
        })
        .on('close', () => log.debug('Server close event'));

      const url = new URL(this.#url);
      setTimeout(() => this.#server.listen(+url.port, url.hostname), 1); // Run async
    });

    if (output === 'retry') {
      if (attempt >= 5) {
        throw new Error('Unable to verify compilation server');
      }
      log.info('Waiting for build to finish, before retrying');
      // Let the server finish
      await this.#client.waitForState(['close'], 'Server closed', this.signal);
      return this.#tryListen(attempt + 1);
    } else if (output === 'ok') {
      await this.#handle.server.writePid(this.info.serverPid);
    }

    return output;
  }

  async #addListener(type: string, res: http.ServerResponse): Promise<void> {
    res.writeHead(200);
    const id = `id_${Date.now()}_${Math.random()}`.replace('.', '1');
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    this.#listeners[id] = { res, type: type as 'change' };
    if (type === 'state') { // Send on initial connect
      res.write(JSON.stringify({ state: this.info.state }));
    }
    res.write('\n'); // Send at least one byte on listen

    // Do not wait on it
    res.on('close', () => { delete this.#listeners[id]; });
  }

  #emitEvent(ev: CompilerEvent): void {
    const msg = `${JSON.stringify(ev.payload)}\n`;
    for (const el of Object.values(this.#listeners)) {
      if (!el.res.closed && el.type === ev.type) {
        el.res.write(msg);
      }
    }
  }

  async #disconnectActive(): Promise<void> {
    log.info('Server disconnect requested');
    this.info.iteration = Date.now();
    await new Promise(r => setTimeout(r, 20));
    for (const el of Object.values(this.#listeners)) {
      try { el.res.end(); } catch { }
    }
    this.#listeners = {}; // Ensure its empty
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

    let out: unknown;
    let close = false;
    switch (action) {
      case 'event': return await this.#addListener(subAction, res);
      case 'clean': out = await this.#clean(); break;
      case 'stop': out = JSON.stringify({ closing: true }); close = true; break;
      case 'info':
      default: out = this.info ?? {}; break;
    }
    res.end(JSON.stringify(out));
    if (close) {
      await this.close();
    }
  }

  /**
   * Process events
   */
  async processEvents(src: (signal: AbortSignal) => AsyncIterable<CompilerEvent>): Promise<void> {
    for await (const ev of CommonUtil.restartableEvents(src, this.signal, this.isResetEvent)) {
      if (ev.type === 'progress') {
        await Log.onProgressEvent(ev.payload);
      }

      this.#emitEvent(ev);

      if (ev.type === 'state') {
        this.info.state = ev.payload.state;
        await this.#handle.compiler.writePid(this.info.compilerPid);
        if (ev.payload.state === 'init' && ev.payload.extra && 'pid' in ev.payload.extra && typeof ev.payload.extra.pid === 'number') {
          this.info.compilerPid = ev.payload.extra.pid;
        }
        log.info(`State changed: ${this.info.state}`);
      } else if (ev.type === 'log') {
        log.render(ev.payload);
      }
      if (this.isResetEvent(ev)) {
        await this.#disconnectActive();
      }
    }

    // Terminate, after letting all remaining events emit
    await this.close();

    log.debug('Finished processing events');
  }

  /**
   * Close server
   */
  async close(): Promise<void> {
    log.info('Closing down server');

    // If we are in a place where progress exists
    if (this.info.state === 'compile-start') {
      const cancel: CompilerProgressEvent = { complete: true, idx: 0, total: 0, message: 'Complete', operation: 'compile' };
      await Log.onProgressEvent(cancel);
      this.#emitEvent({ type: 'progress', payload: cancel });
    }

    try {
      await new Promise((resolve, reject) => {
        setTimeout(reject, 2000).unref(); // 2s max wait
        this.#server.close(resolve);
        this.#emitEvent({ type: 'state', payload: { state: 'close' } });
        setImmediate(() => {
          this.#server.closeAllConnections();
          this.#shutdown.abort();
        });
      });
    } catch { // Timeout or other error
      // Force shutdown
      this.#server.closeAllConnections();
      await this.#handle.compiler.kill();
    }

    log.info('Closed down server');
  }

  /**
   * Start the server listening
   */
  async listen(): Promise<CompilerServer | undefined> {
    const running = await this.#tryListen() === 'ok';
    log.info(running ? 'Starting server' : 'Server already running under a different process', this.#url);
    return running ? this : undefined;
  }
}