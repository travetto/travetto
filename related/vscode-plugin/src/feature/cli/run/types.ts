import type { CliCommandSchema } from '@travetto/cli';

type CliArg = CliCommandSchema['args'][number];

type Arg = Omit<CliArg, 'type'> & {
  type: CliArg['type'] | 'module'
};

/**
 * Run choice
 */
export type RunChoice = Omit<CliCommandSchema, 'args'> & {
  inputs: string[];
  prettyName?: string;
  resolved?: boolean;
  time?: number;
  key?: string;
  args: Arg[];
  inputFlags?: string[];
};

export type ResolvedRunChoice = RunChoice & {
  resolved: true;
  time: number;
  key: string;
};