
/**
 * Entry point for template editing
 */
export async function main(): Promise<void> {
  const { Host, PathUtil } = await import('@travetto/boot');
  const { EnvInit } = await import('@travetto/base/support/bin/init');
  EnvInit.init({
    append: { TRV_RESOURCES: PathUtil.resolveUnix(__dirname, '..', Host.PATH.resources) }
  });
  (await import('../src/editor')).EditorUtil.init();
}