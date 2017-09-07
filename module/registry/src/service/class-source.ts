import { Class } from '../model/types';
import { EventEmitter } from 'events';

export type ChangedEvent = { type: 'changed' | 'added' | 'removed' | 'init', prev?: Class, curr?: Class };

export interface ClassSource {
  init(): Promise<void>;
  on<T>(callback: (e: ChangedEvent) => any, filter?: (e: ChangedEvent) => boolean): void;
}