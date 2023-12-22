import tty from 'node:tty';

export type TerminalStreamingConfig = {
  minDelay?: number;
  outputStreamToMain?: boolean;
};

export type TermState = {
  interactive: boolean;
  height: number;
  width: number;
  input: tty.ReadStream;
  output: tty.WriteStream;
};