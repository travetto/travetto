import type { ApplicationConfig } from '@travetto/app';

/**
 * Application choice
 */
export type AppChoice = ApplicationConfig & {
  inputs: string[];
  time?: number;
  key?: string;
};