import { ShutdownManager } from '@travetto/runtime';
import { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';

/**
 * Channel that represents ipc communication
 */
export class IpcChannel<V = unknown> {

  #emitter = new EventEmitter();
  proc: NodeJS.Process | ChildProcess;
  parentId: number;

  constructor(proc: NodeJS.Process | ChildProcess = process) {
    this.proc = proc;
    this.parentId = process.pid;

    // Close on shutdown
    ShutdownManager.onGracefulShutdown(() => this.destroy(), this);

    this.proc.on('message', (ev: { type: string }) => {
      console.debug('Received', { pid: this.parentId, id: this.id, type: ev.type });
      this.#emitter.emit(ev.type, ev);
      this.#emitter.emit('*', ev);
    });
  }

  /**
   * Gets channel unique identifier
   */
  get id(): number | undefined {
    return this.proc.pid;
  }

  /**
   * Determines if channel is active
   */
  get active(): boolean {
    return (this.proc instanceof ChildProcess) ? !this.proc.killed : !!this.proc.connected;
  }

  /**
   * Send data to the parent
   */
  send(eventType: string, data?: Record<string, unknown>): void {
    console.debug('Sending', { pid: this.parentId, id: this.id, eventType });
    if (!this.active) {
      throw new Error('Cannot send message to inactive process');
    } else if (this.proc.send && this.proc.connected) {
      this.proc.send({ ...(data ?? {}), type: eventType }, (err) => err && console.error(err));
    } else {
      throw new Error('this.proc.send was not defined');
    }
  }

  /**
   * Listen for a specific message type
   */
  on(eventType: string, callback: (e: V & { type: string }) => unknown | void): () => void {
    this.#emitter.on(eventType, callback);
    return () => this.off(eventType, callback);
  }

  /**
   * Remove event listener
   */
  off(eventType: string, callback: (e: V & { type: string }) => unknown | void): void {
    this.#emitter.off(eventType, callback);
  }

  /**
   * Listen for a specific message type, once
   */
  once(eventType: string): Promise<V & { type: string }> {
    return new Promise(res => this.#emitter.once(eventType, res));
  }

  /**
   * Destroy self
   */
  async destroy(): Promise<void> {
    if (this.active) {
      const complete = this.proc instanceof ChildProcess ?
        new Promise<void>(r => this.proc.on('close', r)) :
        undefined;

      console.debug('Killing', { pid: this.parentId, id: this.id });
      if (!('argv' in this.proc)) {
        this.proc.kill();
      }

      await complete;
    }
    this.release();
  }

  /**
   * Remove all listeners, but do not destroy
   */
  release(): void {
    console.debug('Released', { pid: this.parentId, id: this.id });
    this.#emitter.removeAllListeners();
  }
}