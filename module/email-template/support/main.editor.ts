
/**
 * Entry point for template editing
 */
export async function main(): Promise<void> {
  const { PathUtil } = await import('@travetto/boot');
  const { EnvInit } = await import('@travetto/base/support/bin/init');
  EnvInit.init({
    append: { TRV_RESOURCES: PathUtil.resolveUnix(__dirname, '..', 'resources') }
  });
  (await import('./bin/editor')).EditorState.init();
}