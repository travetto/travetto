import { TestEvent } from '../model/event';
import { AllSuitesResult } from '../model/suite';

export interface Consumer {
  onEvent(event: TestEvent): void;
  onSummary?(summary: AllSuitesResult): void;
}