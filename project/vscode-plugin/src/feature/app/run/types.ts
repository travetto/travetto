import { ParamConfig } from '../../../core/types';

/**
 * Application config
 */
export interface Application {
  name: string;
  filename: string;
  params: ParamConfig[];
  id: string;
  start: number;
  codeStart: number;
  root: string;
  description?: string;
  env: string;
}

/**
 * Application choice
 */
export type AppChoice = Application & {
  inputs: string[];
  time?: number;
  key?: string;
};