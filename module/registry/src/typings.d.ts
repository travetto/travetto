import type { METADATA } from './types';

/**
 * Extensions to the Function interface, to provide common
 * information for all registered classes
 */
declare global {
  export interface Function {
    __id: string;
    __file: string;
    [METADATA]: {
      hash: number;
      methods: Record<string, { hash: number }>;
      synthetic: boolean;
      abstract: boolean;
    }
  }
}