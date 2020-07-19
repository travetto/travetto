import { TranspileUtil } from '@travetto/boot';

declare const global: { ts: any }; // Used for transformers

/**
 * Responsible for initializing the transformer support
 */
export const init = {
  key: '@trv:transformer/init',
  before: ['@trv:config/init', '@trv:base/init'], // First
  action: async () => {

    // Inject into global space as 'ts'
    global.ts = new Proxy({}, { // Only in inject as needed
      get(t, p, r) {
        return (global.ts = require('typescript'))[p]; // Overwrite
      }
    });

    // Drop typescript import, and use global. Great speedup;
    TranspileUtil.addPreProcessor((name, contents) => {
      if (/(compiler|transformer|support)/.test(name)) { // Should only ever be in transformation code
        contents = contents.replace(/^import\s+[*]\s+as\s+ts\s+from\s+'typescript'/mg, x => `// ${x}`);
      }
      return contents;
    });
  }
};

