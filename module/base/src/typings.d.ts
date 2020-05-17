import './error';

declare global {
  interface Error {
    /**
     * Provide a representation that is suitable for logging
     * @param sub
     */
    toConsole(sub?: any): string;
  }
  interface Console {
    /**
     * Log at a fatal level
     * @param msg The message to log
     * @param extra The addiitional parameters to log
     */
    fatal: (msg?: string, ...extra: any[]) => void;
  }
}