import { type CompilerLogConfig, fromCompilerLogParamInput, Log, type LogParamInput, type LogShape } from './log.ts';
import { type CompilerLogEvent } from './types.ts';

class IpcLogger implements LogShape {
  render(event: CompilerLogEvent): void {
    if (process.connected && process.send) {
      process.send({ type: 'log', payload: event });
    } else {
      Log.render(event);
    }
  }

  info(message: string, params?: LogParamInput, override?: CompilerLogConfig): void {
    this.render({ ...fromCompilerLogParamInput(params), ...override, level: 'info', message });
  }
  debug(message: string, params?: LogParamInput, override?: CompilerLogConfig): void {
    this.render({ ...fromCompilerLogParamInput(params), ...override, level: 'debug', message });
  }
  warn(message: string, params?: LogParamInput, override?: CompilerLogConfig): void {
    this.render({ ...fromCompilerLogParamInput(params), ...override, level: 'warn', message });
  }
  error(message: string, params?: LogParamInput, override?: CompilerLogConfig): void {
    this.render({ ...fromCompilerLogParamInput(params), ...override, level: 'error', message });
  }
}

export const IpcLog = new IpcLogger();
