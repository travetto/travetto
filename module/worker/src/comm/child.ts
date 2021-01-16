import { ProcessCommChannel } from './channel';

/**
 * Child channel, communicates only to parent
 */
export class ChildCommChannel<U = unknown> extends ProcessCommChannel<NodeJS.Process, U> {
  constructor() {
    super(process);
  }
}