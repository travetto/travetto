import type { CliCommandInput, CliCommandSchema } from '@travetto/cli';

/**
 * Run choice
 */
export type RunChoice = Omit<CliCommandSchema, 'args'> & {
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