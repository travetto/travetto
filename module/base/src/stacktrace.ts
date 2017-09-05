import * as async_hooks from 'async_hooks';
import * as fs from 'fs';
import { AppEnv } from './env';

let ogPrep: any;
let ogName = __filename.replace(/\.js$/, '');

class StackTraceListener {
  currentId: number = -1;
  stackSeparator = '[Continued]\n';
  stackMap = new Map<number, string[]>();
  customPrep: any;
  filters = [
    ogName,
    'timers.js',
    'async_hooks',
    'module.js',
    '(native)',
    '<anonymous>',
    '@encore/base/src/promise',
    'source-map-support.js'
  ];

  constructor() {
    this.init = this.init.bind(this);
    this.destroy = this.destroy.bind(this);
    this.customPrep = (err: any, stck: any) => this.prepareStackTrace(ogPrep ? ogPrep(err, stck) : err, stck);
  }

  addFilters(filters: string[]) {
    this.filters.push(...filters);
  }

  log(msg: string) {
    fs.writeSync(1, msg + '\n');
  }

  filterErrorStack(err: string, removeHead: boolean) {
    const [head, ...rest] = (err || '').split('\n');
    return (removeHead ? '' : `${head}\n`) + (rest
      .filter(l => !this.filters.find(f => l.includes(f)))
      .map(x => x.replace(/ (Function|Proxy)\./, ' <Proxied>.'))
      .join('\n'));
  }

  prepareStackTrace(err: any, stack: any) {
    let parentId = async_hooks.executionAsyncId() || this.currentId;
    let errMsg = (typeof err === 'string' ? err : err.stack) || '';
    errMsg = this.filterErrorStack(errMsg, false);

    if (this.stackMap.has(parentId)) {
      errMsg = [errMsg, ...this.stackMap.get(parentId)!].filter(x => !!x.trim()).slice(0, 6)
        .join('\n' + this.stackSeparator);
    }

    if (typeof err === 'string') {
      err = errMsg;
    } else {
      err.stack = errMsg;
    }

    return err;
  }

  init(id: number, type: string, triggerAsyncId: number, resource: any) {
    if ((Error as any).prepareStackTrace !== this.customPrep) {
      ogPrep = (Error as any).prepareStackTrace;
      (Error as any).prepareStackTrace = this.customPrep;
    }

    let stack: any = {};
    let prep: any = (Error as any).prepareStackTrace;
    (Error as any).prepareStackTrace = ogPrep;
    Error.captureStackTrace(stack);
    (Error as any).prepareStackTrace = prep;

    let parentId = triggerAsyncId || this.currentId;
    let parent = this.stackMap.get(parentId)! || [];
    let frame = this.filterErrorStack(stack.stack, true);

    this.stackMap.set(id, parent[0] === frame ? parent : [frame, ...parent]);
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

let listener: StackTraceListener;

if (!AppEnv.prod) {
  async_hooks.createHook(listener = new StackTraceListener()).enable();
}

export function addStackFilters(...names: string[]) {
  if (listener) {
    listener.addFilters(names);
  }
}