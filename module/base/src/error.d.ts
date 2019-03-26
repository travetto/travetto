import * as all from './error';

declare global {
  export interface Error {
    toConsole?(sub?: any): string;
  }
}