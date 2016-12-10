export interface LoggingContext {
  level: string;
  meta?: any[];
  message?: string;
  timestamp(): string;
}

export const Formatters = {
  standard(opts: LoggingContext) {
    // Return string will be passed to logger.
    let meta = opts.meta && Object.keys(opts.meta).length ? JSON.stringify(opts.meta) : '';
    let level = opts.level.toUpperCase();
    let timestamp = opts.timestamp();
    let message = opts.message || '';

    let out = `${timestamp} ${level}`;
    if (message) {
      out += ' ' + message;
    }
    if (meta) {
      out += ' ' + meta;
    }
  }
}