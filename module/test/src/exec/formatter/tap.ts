import { AllSuitesResult } from '../../model';

export default function TapFormatter(results: AllSuitesResult) {
  return `Results ${results.success}/${results.total}, failed ${results.fail}, skipped ${results.skip}`;
}