import { FieldConfig } from '../../../core/types';

/**
 * Application config
 */
export interface Application {
  name: string;
  root: string;
  filename: string;
  description?: string;
  start: number;
  codeStart: number;
  params: FieldConfig[];
  targetId: string;
  generatedTime?: number;
}

/**
 * Application choice
 */
export type AppChoice = Application & {
  inputs: string[];
  time?: number;
  key?: string;
};