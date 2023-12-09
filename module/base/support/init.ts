import { Env } from '../src/env';
import { ConsoleManager } from '../src/console';

export async function init(): Promise<void> {
  await ConsoleManager.register({ debug: Env.debug });
}