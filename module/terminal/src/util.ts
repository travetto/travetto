import rl from 'node:readline/promises';

import { Env } from '@travetto/runtime';

import { StyleUtil, type TermStyleFn, type TermStyleInput } from './style.ts';
import { type Terminal, WAIT_TOKEN } from './terminal.ts';

export type ProgressEvent<T> = { total?: number, completed: number, value: T, failed?: number };
type ProgressStyle = { complete: TermStyleFn, failed: TermStyleFn, incomplete?: TermStyleFn };

export class TerminalUtil {

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
      style?: { complete: TermStyleInput, failed?: TermStyleInput, incomplete?: TermStyleInput } | (() => ProgressStyle);
    }
  ): (event: ProgressEvent<string>) => string {
    const styleBase = typeof config?.style !== 'function' ? {
      complete: StyleUtil.getStyle(config?.style?.complete ?? { background: '#248613', text: '#ffffff' }),
      failed: StyleUtil.getStyle({ background: '#880000', text: '#ffffff', inverse: false }),
      incomplete: config?.style?.incomplete ? StyleUtil.getStyle(config.style.incomplete) : undefined,
    } : undefined;

    const style = typeof config?.style === 'function' ? config.style : (): ProgressStyle => styleBase!;

    let width: number;
    return event => {
      const text = event.value ?? (event.total ? '%completed/%total' : '%completed');
      const progress = event.total === undefined ? 0 : (event.completed / event.total);
      if (event.total) {
        width ??= Math.trunc(Math.ceil(Math.log10(event.total ?? 10000)));
      }
      const state: Record<string, string> = {
        total: `${event.total}`,
        completed: `${event.completed}`.padStart(width ?? 0),
        progress: `${Math.trunc(progress * 100)}`,
        failed: event.failed ? `${event.failed}` : ''
      };
      const line = ` ${text.replace(/[%](completed|total|progress|failed)/g, (_, key) => state[key])} `;
      const full = term.writer.padToWidth(line, config?.withWaiting ? 2 : 0);
      const mid = Math.trunc(progress * term.width);
      const [left, right] = [full.substring(0, mid), full.substring(mid)];

      const { complete, incomplete, failed } = style();
      const color = event.failed ? failed : complete;
      return `${config?.withWaiting ? `${WAIT_TOKEN} ` : ''}${color(left)}${incomplete?.(right) ?? right}`;
    };
  }
}