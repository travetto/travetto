import { AllSuitesResult, TestResult, SuiteResult } from '../../model';

export default function JSONFormatter(suites: AllSuitesResult) {
  return JSON.stringify(suites, undefined, 2);
}