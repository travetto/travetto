import type { CliCommandInput, CliCommandConfig } from '@travetto/cli';

/**
 * Run choice
 */
export type RunChoice = Omit<CliCommandConfig, 'args'> & {
  inputs: string[];
  prettyName?: string;
  resolved?: boolean;
  time?: number;
  key?: string;
  args: CliCommandInput[];
  inputFlags?: string[];
};

export type ResolvedRunChoice = RunChoice & {
  resolved: true;
  time: number;
  key: string;
};