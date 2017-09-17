import { SuitesResult } from '../model';

export default function JSONFormatter(results: SuitesResult) {
  return JSON.stringify(results);
}