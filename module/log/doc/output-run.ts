export async function main(): Promise<void> {
  const { main: altMain } = await import('@travetto/log/doc/output');
  const { RootRegistry } = await import('@travetto/registry');
  await RootRegistry.init();
  return altMain();
}
