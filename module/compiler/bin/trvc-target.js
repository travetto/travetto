// @ts-check
import '@travetto/runtime/support/patch.js';
import './hook.js';
const { Compiler } = await import('../src/compiler.ts');
await Compiler.main();