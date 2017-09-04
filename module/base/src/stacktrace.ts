import * as async_hooks from 'async_hooks';
import * as fs from 'fs';
import { AppEnv } from './env';

class StackTraceListener {
  currentId: number = -1;
  stackSeparator = 'From previous event:';
  stackMap = new Map<number, string>();

  constructor() {
    (Error as any).prepareStackTrace = (err: any, stack: any) => this.prepareStackTrace(err, stack);
    this.init = this.init.bind(this);
    this.destroy = this.destroy.bind(this);
  }

  log(msg: string) {
    fs.writeSync(1, msg + '\n');
  }

  filterErrorStack(err: string) {
    const [head, ...rest] = (err || '').split('\n');
    return rest
      .filter(l =>
        l.indexOf(__filename) < 0 &&
        l.indexOf('(timers.js') < 0 &&
        l.indexOf('async_hooks') < 0 &&
        l.indexOf('module.js') < 0 &&
        l.indexOf('(native)') < 0 &&
        l.indexOf('source-map-support.js')
      ).join('\n');
  }

  prepareStackTrace(err: any, stack: any) {
    let parentId = async_hooks.executionAsyncId() || this.currentId;

    if (this.stackMap.has(parentId)) {
      err = (err || '') + '\n' + this.stackMap.get(parentId)!;
    }

    return err;
  }

  init(id: number, type: string, triggerAsyncId: number, resource: any) {
    let stack: any = {};
    (Error as any).prepareStackTrace = null;
    Error.captureStackTrace(stack);
    (Error as any).prepareStackTrace = (err: any, stck: any) => this.prepareStackTrace(err, stck);

    let parentId = triggerAsyncId || this.currentId;

    let parent = this.stackMap.get(parentId)!;

    this.stackMap.set(id,
      this.filterErrorStack(stack.stack) +
      (parent ? `\nContinued from\n${parent}` : '')
    );
  }

  before(id: number) {
    this.currentId = id;
  }

  after(id: number) {
    this.currentId = -1;
  }

  destroy(id: number) {
    this.stackMap.delete(id);
  }
}

if (!AppEnv.prod) {
  async_hooks.createHook(new StackTraceListener()).enable();
}