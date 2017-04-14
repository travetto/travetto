import Config from './config';

type StackType = any;

export class Stack {
  constructor(public stack:StackType, public parent: Stack | null) {}

  getStacks() {
    let stacks = [this.stack];
    let parent = this.parent;

    while (true) {
      if (!parent) {
          break;
      }

      stacks.push(parent.stack);
      parent = parent.parent;
    }
    return stacks;
  }
}

/**
 * AsyncListener object
 */
class AsyncListener {
  stackSeparator = 'From previous event:';
  currentStack:Stack|null = null;

  create() {
    // This always gets called in between before/after
    let trace:{name?:string, stack?:StackType} = {};
    Error.captureStackTrace(trace, this.create.bind(this));
    trace.name = this.stackSeparator;
    return new Stack(trace.stack, this.currentStack);
  }

  before(context:any, stack:Stack) {
    this.currentStack = stack;
  }

  after(context:any, stack:Stack) {
    this.currentStack = null;
  }

  error(stack:Stack, err:Error) {
    if (stack) {
        err.stack += '\n' + stack.getStacks().join('\n');
    }
    this.currentStack = null;
  }
}

let listener:AsyncListener;

export function enableLongStacktrace() {
  if (!listener) {
    require('async-listener');    
    Error.stackTraceLimit = Infinity;    
    (process as any).addAsyncListener(listener = new AsyncListener());
  }
}

if (Config.longStackTraces) {
  enableLongStacktrace();
}