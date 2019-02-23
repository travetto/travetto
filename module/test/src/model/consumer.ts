import { TestEvent } from '../model/event';
import { AllSuitesResult } from '../model/suite';

export interface Consumer {
  onStart?(): void;
  onEvent(event: TestEvent): void;
  onSummary?(summary: AllSuitesResult): void;
}