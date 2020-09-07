
import { EventEmitter } from 'events';
import { ExecUtil, ExecutionOptions, ExecutionState } from '@travetto/boot';

/**
 * Tracks the logic for running a process as an IPC-based server
 */
export class ProcessServer {

  private emitter = new EventEmitter();
  private respawn = true;
  private state: ExecutionState;

  constructor(private path: string, private args: string[], private opts: ExecutionOptions) {
    process.on('SIGINT', this.stop.bind(this));
    process.on('exit', this.stop.bind(this));
  }

  on(type: string, handler: (event: any) => void) {
    this.emitter.on(type, handler);
  }

  start() {
    if (!this.running) {
      console.log('Starting', this.path, ...this.args);
      this.emitter.emit('pre-start');
      this.state = ExecUtil.spawn(this.path, this.args, this.opts);

      this.state.process.stdout?.pipe(process.stdout);
      this.state.process.stderr?.pipe(process.stderr);

      this.state.result.finally(() => {
        if (this.respawn) {
          this.emitter.emit('restart');
          this.start();
        }
      });

      this.emitter.emit('start');
    }
  }

  restart() {
    if (!this.running) {
      this.start();
    } else {
      this.state.process.kill();
      // Will auto respawn
    }
  }

  stop() {
    if (this.running) {
      console.log('Stopping', this.path, ...this.args);
      this.respawn = false;
      this.emitter.emit('pre-stop');
      this.state.process.kill();
      this.emitter.emit('stop');
    }
  }

  get running() {
    return this.state && this.state.process && !this.state.process.killed;
  }

  emitMessage(type: string, payload: Record<string, any> = {}) {
    if (!this.running) {
      throw new Error('Server is not running');
    }

    this.state.process.send({ type, ...payload });
  }

  onMessage(types: string | (string | undefined)[], callback: (type: string, payload: Record<string, any>) => void) {
    if (!this.running) {
      throw new Error('Server is not running');
    }

    types = (Array.isArray(types) ? types : [types]).filter(x => !!x);

    const handler = async (msg: { type: string } & Record<string, any>) => {
      if (types.includes(msg.type) || types.includes('*')) {
        callback(msg.type, msg);

      }
    };
    this.state.process.on('message', handler);

    return this.state.process.off.bind(this.state.process, 'message', handler);
  }

  onceMessage(types: string | (string | undefined)[], callback: (type: string, payload: Record<string, any>) => void) {
    const handler = this.onMessage(types, (type: string, payload) => {
      handler();
      callback(type, payload);
    });
  }

  emitMessageAndWaitFor<U>(type: string, payload: Record<string, any>, waitType: string, errType?: string): Promise<U> {
    const prom = new Promise<U>((resolve, reject) => {
      const remove = this.onMessage([waitType, errType], (resType, msg) => {
        remove();
        switch (resType) {
          case waitType: return resolve(msg as U);
          case errType: return reject(msg);
        }
      });
    });

    this.emitMessage(type, payload);
    return prom;
  }
}