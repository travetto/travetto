import { Class } from '../model/types';
import { EventEmitter } from 'events';

export type ChangeEvent = { type: 'changed' | 'added' | 'removing', prev?: Class, curr?: Class };

export interface ClassSource {
  init(): Promise<any>;
  on<T>(callback: (e: ChangeEvent) => any): void;
  reset(): void;
}