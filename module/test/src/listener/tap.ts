import { AllSuitesResult } from '../model';

export default function TapFormatter(results: AllSuitesResult) {
  return `Results ${results.passed}/${results.total}, failed ${results.failed}, skipped ${results.skipped}`;
}