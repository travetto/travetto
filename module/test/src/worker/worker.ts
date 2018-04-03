import { CommonProcess } from './types';

export class Worker<U extends { type: string }, T extends CommonProcess> {

  _proc: T;

  constructor(private proc: Promise<T>) { }

  async init() {
    if (this._proc) {
      return false;
    }

    this._proc = await this.proc;

    return true;
  }

  send(e: U) {
    if (this._proc.send) {
      this._proc.send(e);
    }
  }

  listenOnce(eventType: string, callback: (e: U & { type?: string }) => any) {
    const fn = (event: U) => {
      if (event.type === eventType) {
        this.removeListener(fn);
        callback(event);
      }
    };
    this.listen(fn);
  }

  removeListener(fn: (e: U) => any) {
    this._proc.removeListener('message', fn);
  }

  async listen(handler: (e: U) => Promise<boolean | undefined | void> | boolean | undefined | void) {
    return new Promise((resolve, reject) => {
      const kill = () => {
        this.removeListener(fn);
      };
      const fn = (e: U) => {
        try {
          const res = handler(e);
          if (res === true) {
            kill();
            resolve();
          } else if (res && res.then) {
            res.then((v) => {
              if (v) {
                kill();
                resolve();
              }
            }, err => {
              kill();
              reject(err);
            })
          }
        } catch (e) {
          kill();
          reject(e);
        }
      };
      this._proc.on('message', fn);
    });
  }

  clean() {
    this._proc.removeAllListeners('message');
  }
}