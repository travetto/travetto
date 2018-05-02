import { lineFormatter, LineFormatterOpts } from '../formatter';
import { consoleOutput, ConsoleOutputOpts } from '../output';
import { LogListener, LogEvent } from '../types';

export function consoleListener(opts: {
  formatter: LineFormatterOpts,
  output: ConsoleOutputOpts
}): LogListener {
  const formatter = lineFormatter(opts.formatter);
  const output = consoleOutput(opts.output);

  return e => output(formatter(e));
}

export function combine<T, U>(
  formatterFactory: (opts: T) => (e: LogEvent) => string,
  outputFactory: (opts: U) => (message: string) => void
) {
  return (opts: { formatter: T, output: U }) => {
    const formatter = formatterFactory(opts.formatter);
    const output = outputFactory(opts.output);
    return (e: LogEvent) => output(formatter(e));
  }
}