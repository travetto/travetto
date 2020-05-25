/**
 * Handle app execution failure, with ability to set exit codes
 */
export function handleFailure(err?: Error, exitCode?: number) {
  console.error(err?.toConsole?.() ?? err?.stack ?? err);
  if (exitCode) {
    process.exit(exitCode);
  }
}