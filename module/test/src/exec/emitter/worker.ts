import { ListenEvent } from '../listener';
import { TestEmitter } from './types';

const { serialize } = require('../agent/error');

export class WorkerEmitter implements TestEmitter {
  emit(event: ListenEvent) {
    if (event.phase === 'after') {
      if (event.type === 'test') {
        for (const assrt of event.test.assertions) {
          if (assrt.error) {
            assrt.error = serialize(assrt.error);
          }
        }
        if (event.test.error) {
          event.test.error = serialize(event.test.error);
        }
      }
    }
    process.send(event);
  }
}