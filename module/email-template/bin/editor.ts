/**
 * Entry point for template editings
 */
export async function main() {
  (await import('./lib/editor')).EditorUtil.init();
}