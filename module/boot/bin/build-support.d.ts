export var log: (...args: unknown[]) => void;
export var spawn: (action: string, cmd: string, args: string[], cwd: string, failOnError?: boolean) => Promise<void>;