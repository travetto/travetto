import tty from 'tty';

export type Indexed = { idx: number };
export type DelayedConfig = { initialDelay?: number, cycleDelay?: number };

type I = number;
export type RGB = [r: I, g: I, b: I] | (readonly [r: I, g: I, b: I]);
export type TermCoord = { x: number, y: number };
export type TermLinePosition = 'top' | 'bottom' | 'inline';
export type TermColorField = 'foregroundColor' | 'backgroundColor';

export type TermState = {
  interactive: boolean;
  height: number;
  width: number;
  input: tty.ReadStream;
  output: tty.WriteStream;
};

export type TerminalTableEvent = { idx: number, text: string, done?: boolean };
export type TerminalTableConfig = { header?: string[], forceNonInteractiveOrder?: boolean };
export type TerminalProgressEvent = { idx: number, total?: number, text?: string };
export type TerminalProgressRender = (ev: TerminalProgressEvent) => string;
export type TerminalWaitingConfig = { position?: TermLinePosition } & DelayedConfig;

export type ColorLevel = 0 | 1 | 2 | 3;
export type TermBackgroundScheme = 'dark' | 'light';

export type TermColorState = {
  level: ColorLevel;
  scheme: TermBackgroundScheme;
};