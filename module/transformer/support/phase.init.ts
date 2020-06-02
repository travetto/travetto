import { TranspileUtil } from '@travetto/boot';

/**
 * Responsible for initializing the transformer support
 */
export const init = {
  key: 'transformer',
  before: ['config', 'base'], // First
  action: async () => {
    // Drop typescript import, and use global. Great speedup;
    TranspileUtil.addPreProcessor((name, contents) => {
      if (name.includes('transform')) { // Should only ever be in transformation code
        contents = contents.replace(/^import\s+[*]\s+as\s+ts\s+from\s+'typescript'/g, x => `// ${x}`);
      }
      return contents;
    });
  }
};

