import { Class } from '../model/types';
import { EventEmitter } from 'events';

export type ChangedEvent = { type: 'changed' | 'added' | 'removed' | 'init', prev?: Class, curr?: Class };

export interface ClassSource {
  init(): Promise<any>;
  on<T>(callback: (e: ChangedEvent) => any): void;
}