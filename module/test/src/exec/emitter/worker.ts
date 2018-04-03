import { ListenEvent } from '../listener';
import { TestEmitter } from './types';

const { serialize } = require('../agent/error');

export class WorkerEmitter implements TestEmitter {
  emit(event: ListenEvent) {
    if (event.phase === 'after') {
      if (event.type === 'test') {
        if (event.test.error) {
          event.test.error = serialize(event.test.error);
        }
      } else if (event.type === 'assertion') {
        if (event.assertion.error) {
          event.assertion.error = serialize(event.assertion.error);
        }
      }
    }
    process.send(event);
  }
}