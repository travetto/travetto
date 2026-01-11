import http from 'node:http';
import fs from 'node:fs/promises';
import { setMaxListeners } from 'node:events';

import type { ManifestContext } from '@travetto/manifest';

import {
  type CompilerProgressEvent, type CompilerEvent,
  type CompilerEventType, type CompilerServerInfo
} from '../types.ts';
import { Log } from '../log.ts';
import { CommonUtil } from '../common.ts';
import { CompilerClient } from './client.ts';
import { ProcessHandle } from './process-handle.ts';
import { EventUtil } from '../event.ts';

const log = Log.scoped('server');

/**
 * Compiler Server Class
 */
export class CompilerServer {

  #ctx: ManifestContext;
  #server: http.Server;
  #listenersAll = new Set<http.ServerResponse>();
  #listeners: Partial<Record<CompilerEventType, Record<string, http.ServerResponse>>> = {};
  #shutdown = new AbortController();
  info: CompilerServerInfo;
  #client: CompilerClient;
  #url: string;
  #handle: Record<'compiler' | 'server', ProcessHandle>;

  constructor(ctx: ManifestContext, watching: boolean) {
    this.#ctx = ctx;
    this.#client = new CompilerClient(ctx, Log.scoped('server.client'));
    this.#url = this.#client.url;
    this.#handle = { server: new ProcessHandle(ctx, 'server'), compiler: new ProcessHandle(ctx, 'compiler') };

    this.info = {
      state: 'startup',
      iteration: Date.now(),
      watching,
      serverProcessId: process.pid,
      compilerProcessId: -1,
      path: ctx.workspace.path,
      url: this.#url
    };

    this.#server = http.createServer({
      keepAlive: true,
      requestTimeout: 1000 * 60 * 60,
      keepAliveTimeout: 1000 * 60 * 60,
    }, (request, response) => this.#onRequest(request, response));

    setMaxListeners(1000, this.signal);
  }

  get signal(): AbortSignal {
    return this.#shutdown.signal;
  }

  get watching(): boolean {
    return this.info.watching;
  }

  isResetEvent(event: CompilerEvent): boolean {
    return event.type === 'state' && event.payload.state === 'reset';
  }

  async #tryListen(attempt = 0): Promise<'ok' | 'running'> {
    const output = await new Promise<'ok' | 'running' | 'retry'>((resolve, reject) => {
      this.#server
        .on('listening', () => resolve('ok'))
        .on('error', async error => {
          if ('code' in error && error.code === 'EADDRINUSE') {
            const info = await this.#client.info();
            resolve((info && !info.watching && this.watching) ? 'retry' : 'running');
          } else {
            log.warn('Failed in running server', error);
            reject(error);
          }
        })
        .on('close', () => log.debug('Server close event'));

      const url = new URL(this.#url);
      CommonUtil.queueMacroTask().then(() => this.#server.listen(+url.port, url.hostname)); // Run async
    });

    if (output === 'retry') {
      if (attempt >= 5) {
        throw new Error('Unable to verify compilation server');
      }
      log.info('Waiting for build to finish, before retrying');
      // Let the server finish
      await this.#client.waitForState(['closed'], 'Server closed', this.signal);
      return this.#tryListen(attempt + 1);
    } else if (output === 'ok') {
      await this.#handle.server.writePidFile(this.info.serverProcessId);
    }

    return output;
  }

  #addListener(type: CompilerEventType, response: http.ServerResponse): void {
    response.writeHead(200);
    const id = `id_${Date.now()}_${Math.random()}`.replace('.', '1');
    (this.#listeners[type] ??= {})[id] = response;
    this.#listenersAll.add(response);
    if (type === 'state' || type === 'all') { // Send on initial connect
      this.#emitEvent({ type: 'state', payload: { state: this.info.state } }, id);
    } else {
      response.write('\n'); // Send at least one byte on listen
    }

    response.on('close', () => {
      delete this.#listeners[type]?.[id];
      this.#listenersAll.delete(response);
    });
  }

  #emitEvent(event: CompilerEvent, to?: string): void {
    if (this.#listeners.all) {
      const eventText = JSON.stringify(event);
      for (const [id, item] of Object.entries(this.#listeners.all)) {
        if (item.closed || (to && id !== to)) {
          continue;
        }
        item.write(eventText);
        item.write('\n');
      }
    }
    if (this.#listeners[event.type]) {
      const eventText = JSON.stringify(event.payload);
      for (const [id, item] of Object.entries(this.#listeners[event.type]!)) {
        if (item.closed || (to && id !== to)) {
          continue;
        }
        item.write(eventText);
        item.write('\n');
      }
    }
  }

  async #disconnectActive(): Promise<void> {
    log.info('Server disconnect requested');
    this.info.iteration = Date.now();
    await CommonUtil.blockingTimeout(20);
    for (const listener of this.#listenersAll) {
      try { listener.end(); } catch { }
    }
    this.#listeners = {}; // Ensure its empty
    this.#listenersAll.clear();
  }

  async #clean(): Promise<{ clean: boolean }> {
    await Promise.all([this.#ctx.build.outputFolder, this.#ctx.build.typesFolder]
      .map(folder => fs.rm(CommonUtil.resolveWorkspace(this.#ctx, folder), { recursive: true, force: true })));
    return { clean: true };
  }

  /**
   * Request handler
   */
  async #onRequest(request: http.IncomingMessage, response: http.ServerResponse): Promise<void> {
    response.setHeader('Content-Type', 'application/json');

    const [, action, subAction] = new URL(`${this.#url}${request.url}`).pathname.split('/');

    let out: unknown;
    let close = false;
    switch (action) {
      case 'event': {
        if (EventUtil.isComplilerEventType(subAction)) {
          this.#addListener(subAction, response);
        }
        return;
      }
      case 'clean': out = await this.#clean(); break;
      case 'stop': out = JSON.stringify({ closing: true }); close = true; break;
      case 'info':
      default: out = this.info ?? {}; break;
    }
    response.end(JSON.stringify(out));
    if (close) {
      await this.close();
    }
  }

  /**
   * Process events
   */
  async processEvents(input: (signal: AbortSignal) => AsyncIterable<CompilerEvent>): Promise<void> {
    for await (const event of CommonUtil.restartableEvents(input, this.signal, this.isResetEvent)) {
      if (event.type === 'progress') {
        await Log.onProgressEvent(event.payload);
      }

      this.#emitEvent(event);

      if (event.type === 'state') {
        this.info.state = event.payload.state;
        if (event.payload.state === 'init' && event.payload.extra && 'processId' in event.payload.extra && typeof event.payload.extra.processId === 'number') {
          if (this.info.watching && !this.info.compilerProcessId) {
            // Ensure we are killing in watch mode on first set
            await this.#handle.compiler.kill();
          }
          this.info.compilerProcessId = event.payload.extra.processId;
          await this.#handle.compiler.writePidFile(this.info.compilerProcessId);
        }
        log.info(`State changed: ${this.info.state}`);
      } else if (event.type === 'log') {
        log.render(event.payload);
      }
      if (this.isResetEvent(event)) {
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
        CommonUtil.nonBlockingTimeout(2000).then(reject); // Wait 2s max
        this.#server.close(resolve);
        this.#emitEvent({ type: 'state', payload: { state: 'closed' } });
        CommonUtil.queueMacroTask().then(() => {
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
