import type { CliCommandSchema } from '@travetto/cli';

/**
 * Run choice
 */
export type RunChoice = CliCommandSchema & {
  inputs: string[];
  prettyName?: string;
  resolved?: boolean;
  time?: number;
  key?: string;
  inputFlags?: string[];
};

export type ResolvedRunChoice = RunChoice & {
  resolved: true;
  time: number;
  key: string;
};