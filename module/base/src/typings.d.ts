import './error';

declare global {
  interface Error {
    toConsole(sub?: any): string;
  }
  interface Console {
    fatal: (msg?: string, ...extra: any[]) => void;
  }
  namespace NodeJS {
  }
}