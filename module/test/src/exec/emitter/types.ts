import { ListenEvent } from '../listener';

export interface TestEmitter {
  emit(event: ListenEvent): void;
}