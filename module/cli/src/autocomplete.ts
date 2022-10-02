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
 * Common Autocomplete Utilities
 */
export class AutocompleteUtil {

  /**
   * Get code completion values
   */
  static async getCompletion(cfg: CompletionConfig, args: string[]): Promise<string[]> {
    args = args.slice(0); // Copy as we mutate

    const cmd = args.shift()!;

    let last = cmd;
    let opts: string[] = [];

    // List all commands
    if (!cfg.task[cmd]) {
      opts = cfg.all;
    } else {
      // Look available sub commands
      last = args.pop() ?? '';
      const second = args.pop() ?? '';
      let flag = '';

      if (last in cfg.task[cmd]) {
        flag = last;
        last = '';
      } else if (second in cfg.task[cmd]) {
        // Look for available flags
        if (cfg.task[cmd][second].includes(last)) {
          flag = '';
          last = '';
        } else {
          flag = second;
        }
      }
      opts = cfg.task[cmd][flag];
    }

    return last ? opts.filter(x => x.startsWith(last)) : opts.filter(x => !x.startsWith('-'));
  }
}