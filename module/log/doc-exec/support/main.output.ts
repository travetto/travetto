export async function main() {
  const { main } = await import('@travetto/log/doc/output');
  const { RootRegistry } = await import('@travetto/registry');
  await RootRegistry.init();
  return main();
}
