import tty from 'node:tty';

export type Indexed = { idx: number };
export type DelayedConfig = { initialDelay?: number, cycleDelay?: number };

type I = number;
export type RGB = [r: I, g: I, b: I] | (readonly [r: I, g: I, b: I]);
export type TermCoord = { x: number, y: number };
export type TermLinePosition = 'top' | 'bottom' | 'inline';
export type TermColorField = 'foregroundColor' | 'backgroundColor';

export type TerminalTableEvent = { idx: number, text: string, done?: boolean };
export type TerminalTableConfig = { header?: string[], forceNonInteractiveOrder?: boolean };
export type TerminalProgressEvent = { idx: number, total?: number, text?: string };
export type TerminalProgressRender = (ev: TerminalProgressEvent) => string;
export type TerminalStreamingConfig = { position?: TermLinePosition, clearOnFinish?: boolean, at?: TermCoord, minDelay?: number };
export type TerminalWaitingConfig = { end?: boolean, committedPrefix?: string } & TerminalStreamingConfig & DelayedConfig;

export type TermColorLevel = 0 | 1 | 2 | 3;
export type TermColorScheme = 'dark' | 'light';

export type TermState = {
  interactive: boolean;
  height: number;
  width: number;
  input: tty.ReadStream;
  output: tty.WriteStream;
  colorLevel: TermColorLevel;
  backgroundScheme: TermColorScheme;
  getCursorPosition(): Promise<TermCoord>;
};

export type TermQuery<T> = { query: () => string, response: (inp: Buffer) => T };