import { StyleUtil, TermStyleFn, TermStyleInput } from './style.ts';
import { Terminal, WAIT_TOKEN } from './terminal.ts';

type ProgressEvent<T> = { total?: number, idx: number, value: T };
type ProgressStyle = { complete: TermStyleFn, incomplete?: TermStyleFn };

export class TerminalUtil {

  /**
   * Create a progress bar updater, suitable for streaming to the bottom of the screen
   */
  static progressBarUpdater(
    term: Terminal,
    config?: {
      withWaiting?: boolean;
      style?: { complete: TermStyleInput, incomplete?: TermStyleInput } | (() => ProgressStyle);
    }
  ): (event: ProgressEvent<string>) => string {
    const styleBase = typeof config?.style !== 'function' ? {
      complete: StyleUtil.getStyle(config?.style?.complete ?? { background: '#248613', text: '#ffffff' }),
      incomplete: config?.style?.incomplete ? StyleUtil.getStyle(config.style.incomplete) : undefined,
    } : undefined;

    const style = typeof config?.style === 'function' ? config.style : (): ProgressStyle => styleBase!;

    let width: number;
    return event => {
      const text = event.value ?? (event.total ? '%idx/%total' : '%idx');
      const progress = event.total === undefined ? 0 : (event.idx / event.total);
      if (event.total) {
        width ??= Math.trunc(Math.ceil(Math.log10(event.total ?? 10000)));
      }
      const state: Record<string, string> = { total: `${event.total}`, idx: `${event.idx}`.padStart(width ?? 0), progress: `${Math.trunc(progress * 100)}` };
      const line = ` ${text.replace(/[%](idx|total|progress)/g, (_, key) => state[key])} `;
      const full = term.writer.padToWidth(line, config?.withWaiting ? 2 : 0);
      const mid = Math.trunc(progress * term.width);
      const [left, right] = [full.substring(0, mid), full.substring(mid)];

      const { complete, incomplete } = style();
      return `${config?.withWaiting ? `${WAIT_TOKEN} ` : ''}${complete(left)}${incomplete?.(right) ?? right}`;
    };
  }
}