/**
 * Entry point for template editing
 */
export async function main() {
  const { PathUtil } = await import('@travetto/boot');
  const { EnvInit } = await import('@travetto/base/bin/init');
  EnvInit.init({
    append: { TRV_RESOURCES: PathUtil.resolveUnix(__dirname, '..', 'resources') }
  });
  (await import('./lib/editor')).EditorUtil.init();
}