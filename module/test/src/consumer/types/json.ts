import { AllSuitesResult } from '../../model/suite';
import { TestEvent } from '../../model/event';
import { Consumer } from '../../model/consumer';
import { Consumable } from '../registry';

@Consumable('json')
export class JSONEmitter implements Consumer {

  constructor(private stream: NodeJS.WriteStream = process.stdout) { }

  onEvent(event: TestEvent) { }

  onSummary(summary: AllSuitesResult) {
    this.stream.write(JSON.stringify(summary, undefined, 2));
  }
}