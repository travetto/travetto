import { ParamConfig } from '../../../core/types';

/**
 * Application config
 */
export interface Application {
  name: string;
  filename: string;
  params: ParamConfig[];
  id: string;
  root: string;
  description?: string;
  watchable?: boolean;
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