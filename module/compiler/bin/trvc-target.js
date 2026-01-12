// @ts-check
import './hook.js';
const { Compiler } = await import('../src/compiler.ts');
await Compiler.main();