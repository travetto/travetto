import { TestEvent } from '../model/event';
import { AllSuitesResult } from '../model/suite';

// TODO: Document
export interface Consumer {
  onStart?(): void;
  onEvent(event: TestEvent): void;
  onSummary?(summary: AllSuitesResult): void;
}