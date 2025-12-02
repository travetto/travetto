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
    cfg?: {
      withWaiting?: boolean;
      style?: { complete: TermStyleInput, incomplete?: TermStyleInput } | (() => ProgressStyle);
    }
  ): (event: ProgressEvent<string>) => string {
    const styleBase = typeof cfg?.style !== 'function' ? {
      complete: StyleUtil.getStyle(cfg?.style?.complete ?? { background: '#248613', text: '#ffffff' }),
      incomplete: cfg?.style?.incomplete ? StyleUtil.getStyle(cfg.style.incomplete) : undefined,
    } : undefined;

    const style = typeof cfg?.style === 'function' ? cfg.style : (): ProgressStyle => styleBase!;

    let width: number;
    return event => {
      const text = event.value ?? (event.total ? '%idx/%total' : '%idx');
      const pct = event.total === undefined ? 0 : (event.idx / event.total);
      if (event.total) {
        width ??= Math.trunc(Math.ceil(Math.log10(event.total ?? 10000)));
      }
      const state: Record<string, string> = { total: `${event.total}`, idx: `${event.idx}`.padStart(width ?? 0), pct: `${Math.trunc(pct * 100)}` };
      const line = ` ${text.replace(/[%](idx|total|pct)/g, (_, k) => state[k])} `;
      const full = term.writer.padToWidth(line, cfg?.withWaiting ? 2 : 0);
      const mid = Math.trunc(pct * term.width);
      const [l, r] = [full.substring(0, mid), full.substring(mid)];

      const { complete, incomplete } = style();
      return `${cfg?.withWaiting ? `${WAIT_TOKEN} ` : ''}${complete(l)}${incomplete?.(r) ?? r}`;
    };
  }
}