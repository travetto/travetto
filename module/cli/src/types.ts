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