import { TestEvent } from '../model/event';
import { AllSuitesResult } from '../model/suite';
import { Consumer } from '../model/consumer';

export class JSONEmitter implements Consumer {

  constructor(private stream: NodeJS.WriteStream = process.stdout) { }

  onEvent(event: TestEvent) { }

  onSummary(summary: AllSuitesResult) {
    this.stream.write(JSON.stringify(summary, undefined, 2));
  }
}