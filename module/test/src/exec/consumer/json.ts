import { AllSuitesResult, TestResult, SuiteResult, TestEvent } from '../../model';
import { Consumer } from './types';

export class JSONEmitter implements Consumer {

  constructor(private stream: NodeJS.WriteStream = process.stdout) { }

  onEvent(event: TestEvent) { }

  onSummary(summary: AllSuitesResult) {
    this.stream.write(JSON.stringify(summary, undefined, 2));
  }
}