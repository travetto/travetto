export async function main(): Promise<void> {
  const { main: altMain } = await import('@travetto/log/doc/output.ts');
  const { Registry } = await import('@travetto/registry');
  await Registry.init();
  return altMain();
}
