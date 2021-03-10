/**
 * Trigger direct build
 */
export async function main() {
  const { PhaseManager } = await import('@travetto/base');
  // Standard transpile
  await PhaseManager.run('init', '@trv:base/transpile');
}