import * as async_hooks from 'async_hooks';
import * as fs from 'fs';
import { AppEnv } from './env';

let installed = false;
let ogPrep: any;

let ogName = __filename.replace(/\.js$/, '');

class StackTraceListener {
  currentId: number = -1;
  stackSeparator = 'Continued from';
  stackMap = new Map<number, string>();
  ogPrep: any;


  constructor() {
    this.init = this.init.bind(this);
    this.destroy = this.destroy.bind(this);
  }

  log(msg: string) {
    fs.writeSync(1, msg + '\n');
  }

  filterErrorStack(err: string, removeHead: boolean) {
    const [head, ...rest] = (err || '').split('\n');
    return (removeHead ? '' : `${head}\n`) + (rest
      .filter(l =>
        l.indexOf(ogName) < 0 &&
        l.indexOf('timers.js') < 0 &&
        l.indexOf('async_hooks') < 0 &&
        l.indexOf('module.js') < 0 &&
        l.indexOf('(native)') < 0 &&
        l.indexOf('source-map-support.js')
      ).join('\n'));
  }

  prepareStackTrace(err: any, stack: any) {
    let parentId = async_hooks.executionAsyncId() || this.currentId;
    let errMsg = (typeof err === 'string' ? err : err.stack) || '';
    errMsg = this.filterErrorStack(errMsg, false);

    if (this.stackMap.has(parentId)) {
      errMsg += '\n' + this.stackMap.get(parentId)!;
    }

    if (typeof err === 'string') {
      err = errMsg;
    } else {
      err.stack = errMsg;
    }

    return err;
  }

  init(id: number, type: string, triggerAsyncId: number, resource: any) {
    if (!installed) {
      installed = true;
      ogPrep = (Error as any).prepareStackTrace;
      console.log('ogprep', ogPrep);
      (Error as any).prepareStackTrace = (err: any, stck: any) => this.prepareStackTrace(ogPrep ? ogPrep(err, stck) : err, stck);

    }
    let stack: any = {};
    let prep: any = (Error as any).prepareStackTrace;
    (Error as any).prepareStackTrace = ogPrep;
    Error.captureStackTrace(stack);
    (Error as any).prepareStackTrace = prep;

    let parentId = triggerAsyncId || this.currentId;
    let parent = this.stackMap.get(parentId)!;

    this.stackMap.set(id,
      this.filterErrorStack(stack.stack, true) +
      (parent ? `\n${this.stackSeparator}\n${parent}` : '')
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