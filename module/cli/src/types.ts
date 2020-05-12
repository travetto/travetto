import * as commander from 'commander';

/**
 * Completion interface
 */
export interface CompletionConfig {
  /**
   * All top level commands
   */
  all: string[];
  /**
   * Flags for sub tasks
   */
  task: {
    [key: string]: {
      [key: string]: string[];
    };
  };
}

/**
 * CLI Plugin structure
 */
export interface Plugin {
  init(): commander.Command | Promise<commander.Command>;
  complete(config: CompletionConfig): void | Promise<void>;
  setup?(): Promise<any>;
}
