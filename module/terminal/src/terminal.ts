import tty from 'tty';

import { IterableUtil, MapFn } from './iterable';
import {
  TermColorLevel, TermColorScheme, TerminalProgressEvent, TerminalTableConfig,
  TerminalTableEvent, TerminalWaitingConfig, TermLinePosition, TermState, TermCoord
} from './types';
import { TerminalOperation } from './operation';
import { TerminalQuerier } from './query';
import { TerminalWriter } from './writer';
import { ColorOutputUtil, Prim, TermColorFn, TermColorPalette, TermColorPaletteInput, TermStyleInput } from './color-output';

type TerminalStreamPositionConfig = {
  position?: TermLinePosition;
  staticMessage?: string;
};

type TerminalProgressConfig = TerminalStreamPositionConfig & {
  style?: TermStyleInput;
};

/**
 * An enhanced tty write stream
 */
export class Terminal implements TermState {

  static async for(config: Partial<TermState>): Promise<Terminal> {
    const term = new Terminal(config);
    await term.init();
    return term;
  }

  #init: Promise<void>;
  #output: tty.WriteStream;
  #input: tty.ReadStream;
  #interactive: boolean;
  #width?: number;
  #backgroundScheme?: TermColorScheme;
  #colorLevel?: TermColorLevel;
  #query: TerminalQuerier;

  constructor(config: Partial<TermState>) {
    this.#output = config.output ?? process.stdout;
    this.#input = config.input ?? process.stdin;
    this.#interactive = config.interactive ?? (this.#output.isTTY && !/^(true|yes|on|1)$/i.test(process.env.TRV_QUIET ?? ''));
    this.#width = config.width;
    this.#colorLevel = config.colorLevel;
    this.#backgroundScheme = config.backgroundScheme;
    this.#query = TerminalQuerier.for(this.#input, this.#output);
  }

  get output(): tty.WriteStream {
    return this.#output;
  }

  get input(): tty.ReadStream {
    return this.#input;
  }

  get interactive(): boolean {
    return this.#interactive;
  }

  get width(): number {
    return this.#width ?? (this.#output.isTTY ? this.#output.columns : 120);
  }

  get height(): number {
    return (this.#output.isTTY ? this.#output.rows : 120);
  }

  get colorLevel(): TermColorLevel {
    return this.#colorLevel ?? 0;
  }

  get backgroundScheme(): TermColorScheme {
    return this.#backgroundScheme ?? 'dark';
  }

  writer(): TerminalWriter {
    return TerminalWriter.for(this);
  }

  async writeLines(...text: string[]): Promise<void> {
    return this.writer().writeLines(text, this.interactive).commit();
  }

  async init(): Promise<void> {
    if (!this.#init) {
      this.#init = (async (): Promise<void> => {
        this.#colorLevel ??= await ColorOutputUtil.readTermColorLevel(this.#output);
        this.#backgroundScheme ??= await ColorOutputUtil.readBackgroundScheme(
          () => this.interactive ? this.#query.backgroundColor() : undefined
        );
      })();
    }
    return this.#init;
  }

  async reset(): Promise<void> {
    await this.#query.close();
    if (this.interactive) {
      await this.writer().reset().commit();
    }
    return;
  }

  getCursorPosition(): Promise<TermCoord> {
    return this.#query.cursorPosition();
  }

  /**
   * Waiting message with a callback to end
   */
  async withWaiting<T>(message: string, work: Promise<T> | (() => Promise<T>), config: TerminalWaitingConfig = {}): Promise<T> {
    const res = (typeof work === 'function' ? work() : work);
    if (!this.interactive) {
      await this.writeLines(`${message}...`);
      return res;
    }
    return res.finally(TerminalOperation.streamWaiting(this, message, config));
  }

  /**
   * Stream line output, showing a waiting indicator for each line until the next one occurs
   *
   * @param lines
   * @param config
   * @returns
   */
  async streamLinesWithWaiting(lines: AsyncIterable<string>, config: TerminalWaitingConfig): Promise<void> {
    if (!this.interactive) {
      for await (const line of lines) {
        await this.writeLines(line);
      }
    } else {
      return TerminalOperation.streamLinesWithWaiting(this, lines, { position: 'bottom', ...config });
    }
  }

  /**
   * Consumes a stream, of events, tied to specific list indices, and updates in place
   */
  async streamList<T>(source: AsyncIterable<T>, resolve: MapFn<T, TerminalTableEvent>, config: TerminalTableConfig = {}): Promise<void> {
    const resolved = IterableUtil.map(source, resolve);

    await this.writeLines(...(config.header ?? []));

    if (!this.interactive) {
      const isDone = IterableUtil.filter(resolved, ev => !!ev.done);
      if (config.forceNonInteractiveOrder) {
        await this.writeLines(...(await IterableUtil.drain(isDone)).map(x => x.text), '');
      } else {
        await IterableUtil.drain(IterableUtil.map(isDone, ev => this.writeLines(ev.text)));
        await this.writeLines('');
      }
      return;
    }

    await TerminalOperation.streamList(this, resolved);
  }

  /**
   * Streams an iterable to a specific location, with support for non-interactive ttys
   */
  async streamToPosition<T>(source: AsyncIterable<T>, resolve: MapFn<T, string>, config?: TerminalStreamPositionConfig): Promise<void> {
    if (!this.interactive) {
      if (config?.staticMessage) {
        await this.writeLines(config.staticMessage);
      }
      await IterableUtil.drain(source);
      return;
    }
    return TerminalOperation.streamToPosition(this, IterableUtil.map(source, resolve), config?.position);
  }

  /**
   * Track progress of an asynchronous iterator, allowing the showing of a progress bar if the stream produces idx and total
   */
  async trackProgress<T, V extends TerminalProgressEvent>(
    source: AsyncIterable<T>, resolve: MapFn<T, V>, config?: TerminalProgressConfig
  ): Promise<void> {
    const render = TerminalOperation.buildProgressBar(this, config?.style ?? { background: 'limeGreen', text: 'black' });
    return this.streamToPosition(source, async (v, i) => render(await resolve(v, i)), config);
  }

  /** Creates a colorer function */
  colorer(style: TermStyleInput | [light: TermStyleInput, dark: TermStyleInput]): TermColorFn {
    return ColorOutputUtil.colorer(this, style);
  }

  /** Creates a color palette based on input styles */
  palette<P extends TermColorPaletteInput>(input: P): TermColorPalette<P> {
    return ColorOutputUtil.palette(this, input);
  }

  /** Convenience method to creates a color template function based on input styles */
  templateFunction<P extends TermColorPaletteInput>(input: P): (key: keyof P, val: Prim) => string {
    return ColorOutputUtil.templateFunction(this, input);
  }
}

export const GlobalTerminal = new Terminal({ output: process.stdout });

// Trigger
GlobalTerminal.init();