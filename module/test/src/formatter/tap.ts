import { SuitesResult } from '../model';

export default function TapFormatter(results: SuitesResult) {
  return `Results ${results.passed}/${results.total}, failed ${results.failed}, skipped ${results.skipped}`;
}