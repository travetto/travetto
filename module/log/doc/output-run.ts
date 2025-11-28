export async function main(): Promise<void> {
  const { main: altMain } = await import('@travetto/log/doc/output.ts');
  const { Registry: RegistryV2 } = await import('@travetto/registry');
  await RegistryV2.init();
  return altMain();
}
