import { LogListener, LogEvent } from '../types';

export function filter(pred: (e: LogEvent) => boolean, listener: LogListener): LogListener {
  return (e: LogEvent) => {
    if (pred(e)) {
      listener(e);
    }
  };
}