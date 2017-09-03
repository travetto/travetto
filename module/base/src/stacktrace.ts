import * as async_hooks from 'async_hooks';
import { AppEnv } from './env';

const cwd = process.cwd();

/**
 * AsyncListener object
 */
class AsyncListener {
  stackSeparator = 'From previous event:';
  stackMap = new Map<number, [string, number]>();

  constructor() {
    // Wrap sourcemap tool
    const prep = (Error as any).prepareStackTrace;
    (Error as any).prepareStackTrace = this.prepareStackTrace.bind(this, prep);
    this.filterErrorStack = this.filterErrorStack.bind(this);
  }

  prepareStackTrace(ogPrepare: (err: any, stack: any) => string, err: any, stack: any) {
    const errs: string[] = [ogPrepare(err, stack)];
    let parentId = async_hooks.triggerAsyncId();
    while (this.stackMap.has(parentId)) {
      [stack, parentId] = this.stackMap.get(parentId)!;
      errs.push(stack);
    }

    return errs.map(this.filterErrorStack).join(`\n${this.stackSeparator}`);
  }

  filterErrorStack(err: string) {
    const [head, ...rest] = err.split('\n');
    return [head, ...rest
      .filter(l =>
        l.indexOf(__filename) < 0 &&
        l.indexOf('module.js') < 0 &&
        l.indexOf('source-map-support.js') < 0 &&
        (l.indexOf('node_modules') > 0 ||
          (l.indexOf('(native)') < 0 && (l.indexOf(cwd) < 0 || l.indexOf('.js') < 0))))
    ].join('\n');
  }

  init(id: number, type: string, triggerAsyncId: number, resource: any) {
    // This always gets called in between before/after
    let trace: any = {};
    Error.captureStackTrace(trace, this.constructor);
    this.stackMap.set(id, [trace.stack, triggerAsyncId]);
  }

  before(id: number) {
  }

  after(id: number) {
  }

  destroy(id: number) {
    this.stackMap.delete(id);
  }
}

if (!AppEnv.prod) {
  async_hooks.createHook(new AsyncListener()).enable();
}