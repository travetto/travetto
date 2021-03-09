/**
 * Trigger Direct compilation
 */
export async function main() {
  const { PhaseManager } = await import('@travetto/base');
  // Standard compile
  await PhaseManager.run('init', '@trv:compiler/compile');
}