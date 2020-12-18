import { ChildProcess } from 'child_process';

/**
 * Channel that represents communication between parent/child
 */
export class ProcessCommChannel<T extends NodeJS.Process | ChildProcess, V = any, U extends { type: string } = V & { type: string }> {

  proc: T | undefined;

  constructor(proc: T) {
    this.proc = proc;
    console.debug('Constructed Execution', { pid: this.id });
    this.listen((e) => { // Log in one place
      console.debug('Received', { pid: this.parentId, id: this.id, type: e.type });
    });
  }

  private get parentId() {
    return process.pid;
  }

  /**
   * Gets channel unique identifier
   */
  get id() {
    return this.proc && this.proc.pid;
  }

  /**
   * Determines if channel is active
   */
  get active() {
    return !!this.proc;
  }

  /**
   * Send data to the parent
   */
  send(eventType: string, data?: any) {
    console.debug('Sending', { pid: this.parentId, id: this.id, eventType });
    if (!this.proc) {
      throw new Error('this.proc was not defined');
    } else if (this.proc.send) {
      this.proc.send({ type: eventType, ...(data ?? {}) });
    } else {
      throw new Error('this.proc.send was not defined');
    }
  }

  /**
   * Listen for an event, once
   */
  listenOnce(eventType: string): Promise<U>;
  listenOnce(eventType: string, callback: (e: U) => any): void;
  listenOnce(eventType: string, callback?: (e: U) => any) {
    if (callback) {
      return this.listenFor(eventType, (d, kill) => {
        kill!();
        callback(d);
      });
    } else {
      return new Promise(resolve => {
        this.listenFor(eventType, (d, kill) => {
          kill!();
          resolve(d);
        });
      });
    }
  }

  /**
   * Remove a specific listener
   */
  removeListener(fn: (e: U) => any) {
    if (this.proc) {
      this.proc.removeListener('message', fn);
    }
  }

  /**
   * Listen for a specific message type
   */
  listenFor(eventType: string, callback: (e: U, complete: Function) => any) {
    const fn = (event: U, kill: Function) => {
      if (event.type === eventType) {
        callback(event, kill);
      }
    };
    this.listen(fn);
  }

  /**
   * Listen, and return a handle to remove listener when desired
   */
  listen(handler: (e: U, complete: Function) => any) {
    if (!this.proc) {
      return;
    }

    const holder: { fn?(e: U): void } = {};

    const kill = (e?: any) => {
      this.removeListener(holder.fn!);
    };

    holder.fn = (e: U) => {
      let res;
      try {
        res = handler(e, kill);
        if (res && res.catch) {
          res.catch(kill);
        }
      } catch (err) {
        kill(err);
      }
    };

    this.proc.on('message', holder.fn);

    return kill;
  }

  /**
   * Destroy self
   */
  async destroy() {
    if (this.proc) {
      console.debug('Killing', { pid: this.parentId, id: this.id });
    }
    this.release();
    delete this.proc;
  }

  /**
   * Remove all listeners, but do not destroy
   */
  release() {
    if (this.proc) {
      console.debug('Released', { pid: this.parentId, id: this.id });
      this.proc.removeAllListeners('message');
    }
  }
}