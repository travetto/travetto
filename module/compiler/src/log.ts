import { stripVTControlCharacters } from 'node:util';

import chalk from 'chalk';

import { CompilerLogger, type CompilerLogEvent, type CompilerLogLevel, type CompilerProgressEvent } from './types.ts';

const LEVEL_TO_PRIORITY: Record<CompilerLogLevel, number> = { debug: 1, info: 2, warn: 3, error: 4 };
const SCOPE_MAX = 15;
const SPINNER_FRAMES = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';
const SPINNER_INTERVAL_MS = 80;
const PROGRESS_BAR_WIDTH = 20;
const DEFAULT_TERMINAL_WIDTH = 120;
const MIN_MESSAGE_WIDTH = 4;
const PARTIAL_BLOCKS = [' ', '▏', '▎', '▍', '▌', '▋', '▊', '▉'];

class Logger extends CompilerLogger {
  static #linePartial: boolean | undefined;

  /** Rewrite text line, tracking cleanup as necessary */
  static rewriteLine(text: string): Promise<void> | void {
    if ((!text && !this.#linePartial) || !process.stdout.isTTY) {
      return;
    }
    if (this.#linePartial === undefined) {
      // First time
      process.stdout.write(`\x1b[?25l`); // Hide cursor
      process.on('exit', () => process.stdout.write(`\x1b[!p\x1b[?25h`)); // Restore cursor
    }
    // Move to 1st position, and clear after text
    const done = process.stdout.write(`\x1b[1G${text}\x1b[0K`);
    this.#linePartial = !!text;
    if (!done) {
      return new Promise<void>(resolve => process.stdout.once('drain', resolve));
    }
  }

  #level?: CompilerLogLevel;
  #disabled?: boolean;

  workspace: string = process.cwd();
  scope?: string;
  parent?: Logger;

  constructor(config: { level?: CompilerLogLevel; scope?: string; disabled?: boolean } = {}, parent?: Logger) {
    super();
    this.parent = parent;
    this.scope = config.scope;
    this.#level = config.level;
    this.#disabled = config.disabled;
  }

  get disabled(): boolean {
    return this.#disabled ?? this.parent?.disabled ?? false;
  }

  set disabled(value: boolean) {
    this.#disabled = value;
  }

  get level(): CompilerLogLevel {
    return this.#level ?? this.parent?.level ?? 'debug';
  }

  set level(value: CompilerLogLevel) {
    this.#level = value;
  }

  /** Get if we should log progress */
  get logProgress(): boolean {
    return process.stdout.isTTY && !this.disabled;
  }

  /** Produce a scoped logger */
  scoped(name: string): Logger {
    return new Logger({ scope: name }, this);
  }

  /** Compute the current animated spinner frame */
  #computeSpinnerFrame(): string {
    const frame = Math.trunc(Date.now() / SPINNER_INTERVAL_MS);
    return chalk.green(SPINNER_FRAMES[frame % SPINNER_FRAMES.length]);
  }

  /** Render a smooth fractional-block progress bar */
  #renderProgressBar(ratio: number): string {
    const exact = ratio * PROGRESS_BAR_WIDTH;
    const filledCount = Math.floor(exact);
    const partialIndex = Math.floor((exact - filledCount) * PARTIAL_BLOCKS.length);
    const partial = filledCount < PROGRESS_BAR_WIDTH && partialIndex > 0 ? PARTIAL_BLOCKS[partialIndex] : '';
    const emptyCount = Math.max(0, PROGRESS_BAR_WIDTH - filledCount - (partial ? 1 : 0));

    const filledPart = filledCount ? chalk.green('█'.repeat(filledCount)) : '';
    const partialPart = partial ? chalk.green.bgBlackBright(partial) : '';
    const emptyPart = emptyCount ? chalk.bgBlackBright(' '.repeat(emptyCount)) : '';
    return `${filledPart}${partialPart}${emptyPart}`;
  }

  /** Format the full progress line, truncating the message to fit the terminal width */
  #layoutProgressLine(event: CompilerProgressEvent): string {
    const ratio = event.total ? Math.min(1, Math.max(0, event.idx / event.total)) : 0;
    const percent = `${Math.trunc(ratio * 100)}`.padStart(3);
    const spinner = this.#computeSpinnerFrame();
    const bar = this.#renderProgressBar(ratio);
    const counts = `[${event.idx}/${event.total}]`;
    const prefix = `${spinner} Compiling ${bar} ${chalk.bold(`${percent}%`)} ${chalk.dim(counts)}`;
    const prefixWidth = stripVTControlCharacters(prefix).length + 1;
    const availableWidth = (process.stdout.columns || DEFAULT_TERMINAL_WIDTH) - prefixWidth;
    const message =
      availableWidth > MIN_MESSAGE_WIDTH && event.message.length > availableWidth
        ? `${event.message.slice(0, availableWidth - 1)}…`
        : event.message;
    return `${prefix} ${chalk.dim(message)}`;
  }

  /** Write progress event, if active */
  onProgressEvent(event: CompilerProgressEvent): void | Promise<void> {
    if (!this.logProgress) {
      return;
    }
    return Logger.rewriteLine(event.complete ? '' : this.#layoutProgressLine(event));
  }

  /** Log event with filtering by level */
  render(event: CompilerLogEvent): void {
    if ((this.disabled && event.level !== 'error') || LEVEL_TO_PRIORITY[this.level] > LEVEL_TO_PRIORITY[event.level]) {
      return;
    }
    const params = [event.message, ...(event.args ?? [])].map(arg =>
      typeof arg === 'string' ? arg.replaceAll(this.workspace ?? this.parent?.workspace, '.') : arg
    );

    if (event.scope ?? this.scope) {
      params.unshift(`[${(event.scope ?? this.scope!).padEnd(SCOPE_MAX, ' ')}]`);
    }
    params.unshift(new Date().toISOString(), `${event.level.padEnd(5)}`);
    Logger.rewriteLine(''); // Clear out progress line, if active
    console[event.level]!(...params);
  }
}

const build = process.env.TRV_BUILD;
export const Log = new Logger({
  level: build === 'debug' || build === 'info' || build === 'warn' || build === 'error' ? build : 'debug',
  disabled: (/^(1|true|on|yes)$/i.test(process.env.TRV_QUIET ?? '') && !build) || build === 'none'
});

class IpcLogger extends CompilerLogger {
  render(event: CompilerLogEvent): void {
    if (process.connected && process.send) {
      process.send({ type: 'log', payload: event });
    } else {
      Log.render(event);
    }
  }
}

export const IpcLog = new IpcLogger();
