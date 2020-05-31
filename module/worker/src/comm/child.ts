import { ProcessCommChannel } from './channel';

/**
 * Child channel, communicates only to parent
 */
export class ChildCommChannel<U = any> extends ProcessCommChannel<NodeJS.Process, U> {
  constructor() {
    super(process);
  }
}