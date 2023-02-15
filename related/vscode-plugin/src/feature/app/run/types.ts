import type { ApplicationConfig } from '@travetto/app';

/**
 * Application choice
 */
export type AppChoice = ApplicationConfig & {
  inputs: string[];
  file: string;
  resolved?: boolean;
  time?: number;
  key?: string;
};

export type ResolvedAppChoice = AppChoice & {
  resolved: true;
  time: number;
  key: string;
};