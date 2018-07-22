import { TestEvent, AllSuitesResult } from '../model';

export interface Consumer {
  onEvent(event: TestEvent): void;
  onSummary?(summary: AllSuitesResult): void;
}