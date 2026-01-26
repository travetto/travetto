import type { ChildProcess, SpawnOptions } from 'node:child_process';

export type RunConfig = {
  filter?: (line: string) => boolean;
  rewrite?: (line: string) => string;
  module?: string;
  env?: Record<string, string>;
  workingDirectory?: string;
  spawn?: (cmd: string, args: string[], options: SpawnOptions) => ChildProcess;
};

export type CodeSourceInput = string | Promise<string> | Function;

export type CodeProps = { title?: string, src: CodeSourceInput, language?: string, outline?: boolean, startRe?: RegExp, endRe?: RegExp };