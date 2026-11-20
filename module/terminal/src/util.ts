import rl from 'node:readline/promises';
import { stripVTControlCharacters } from 'node:util';

import chalk from 'chalk';

import { Env } from '@travetto/runtime';

import { StyleUtil, type TermStyleFn, type TermStyleInput } from './style.ts';
import { type Terminal, WAIT_TOKEN } from './terminal.ts';

export type ProgressEvent<T> = { total?: number; completed: number; value: T; failed?: number };
type ProgressStyle = { complete: TermStyleFn; failed: TermStyleFn; incomplete?: TermStyleFn };

const PROGRESS_BAR_WIDTH = 20;
const MIN_MESSAGE_WIDTH = 4;
const PARTIAL_BLOCKS = [' ', '▏', '▎', '▍', '▌', '▋', '▊', '▉'];

type ProgressStyleConfig = { complete: TermStyleInput; failed?: TermStyleInput; incomplete?: TermStyleInput } | (() => ProgressStyle);

export class TerminalUtil {
  /** Resolve a foreground style function from a style input */
  static #getForegroundStyle(input: TermStyleInput): TermStyleFn {
    return StyleUtil.getStyle(typeof input === 'string' ? input : (input.background ?? input.text));
  }

  /** Resolve a style getter from static style inputs or a dynamic callback */
  static #resolveProgressStyle(style?: ProgressStyleConfig): () => ProgressStyle {
    if (typeof style === 'function') {
      return style;
    }
    const resolved: ProgressStyle = {
      complete: style?.complete ? this.#getForegroundStyle(style.complete) : chalk.cyan,
      failed: style?.failed ? this.#getForegroundStyle(style.failed) : chalk.red,
      incomplete: style?.incomplete ? StyleUtil.getStyle(style.incomplete) : undefined
    };
    return () => resolved;
  }

  /** Format a progress event message by substituting template tokens */
  static #formatProgressMessage(event: ProgressEvent<string>, progress: number, countWidth: number): string {
    const text = event.value ?? (event.total ? '%completed/%total' : '%completed');
    const state: Record<string, string> = {
      total: `${event.total}`,
      completed: `${event.completed}`.padStart(countWidth),
      progress: `${Math.trunc(progress * 100)}`,
      failed: `${event.failed ?? 0}`
    };
    return text.replace(/[%](completed|total|progress|failed)/g, (_, key) => state[key]);
  }

  /** Truncate a progress message to fit the remaining terminal width */
  static #truncateProgressMessage(message: string, prefix: string, maxWidth: number): string {
    const prefixWidth = stripVTControlCharacters(prefix.replace(WAIT_TOKEN, ' ')).length + 1;
    const availableWidth = maxWidth - prefixWidth;
    return availableWidth > MIN_MESSAGE_WIDTH && message.length > availableWidth ? `${message.slice(0, availableWidth - 1)}…` : message;
  }

  /** Render a smooth fractional-block progress bar */
  static #renderProgressBar(ratio: number, color: TermStyleFn, incomplete?: TermStyleFn): string {
    const exact = ratio * PROGRESS_BAR_WIDTH;
    const filledCount = Math.floor(exact);
    const partialIndex = Math.floor((exact - filledCount) * PARTIAL_BLOCKS.length);
    const partial = filledCount < PROGRESS_BAR_WIDTH && partialIndex > 0 ? PARTIAL_BLOCKS[partialIndex] : '';
    const emptyCount = Math.max(0, PROGRESS_BAR_WIDTH - filledCount - (partial ? 1 : 0));

    const filledPart = filledCount ? color('█'.repeat(filledCount)) : '';
    const partialPart = partial ? chalk.bgWhiteBright(color(partial)) : '';
    const emptyPart = emptyCount ? (incomplete?.(' '.repeat(emptyCount)) ?? chalk.bgWhiteBright(' '.repeat(emptyCount))) : '';
    return `${filledPart}${partialPart}${emptyPart}`;
  }
  /**
   * Determine if the terminal session is interactive
   */
  static isInteractive(): boolean {
    return process.stdout.isTTY && process.stdin.isTTY && !Env.TRV_QUIET.isTrue;
  }

  /**
   * Prompt the user for input
   */
  static async prompt(message: string): Promise<string> {
    if (!this.isInteractive()) {
      return '';
    }
    const reader = rl.createInterface({ input: process.stdin, output: process.stdout });
    try {
      return (await reader.question(message)).trim();
    } finally {
      reader.close();
    }
  }

  /**
   * Create a progress bar updater, suitable for streaming to the bottom of the screen
   */
  static progressBarUpdater(
    term: Terminal,
    config?: {
      withWaiting?: boolean;
      style?: ProgressStyleConfig;
    }
  ): (event: ProgressEvent<string>) => string {
    const getStyle = this.#resolveProgressStyle(config?.style);
    let countWidth = 0;

    return event => {
      const progress = event.total ? Math.min(1, Math.max(0, event.completed / event.total)) : 0;
      if (event.total && !countWidth) {
        countWidth = Math.trunc(Math.ceil(Math.log10(event.total)));
      }
      const { complete, incomplete, failed } = getStyle();
      const color = event.failed ? failed : progress >= 1 && !config?.style ? chalk.green : complete;
      const bar = this.#renderProgressBar(progress, color, incomplete);
      const percent = `${Math.trunc(progress * 100)}`.padStart(3);
      const prefix = `${config?.withWaiting ? `${WAIT_TOKEN} ` : ''}${bar} ${chalk.bold(`${percent}%`)}`;
      const message = this.#formatProgressMessage(event, progress, countWidth);
      return `${prefix} ${this.#truncateProgressMessage(message, prefix, term.width)}`;
    };
  }
}
