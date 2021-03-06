import { CliUtil } from '@travetto/cli/src/util';

/**
 * Utils for generation
 */
export class GenerateUtil {
  /**
   * Run the generate process
   */
  static async generate() {
    const { PhaseManager } = await import('@travetto/base');
    await PhaseManager.run('init');

    const { DependencyRegistry } = await import('@travetto/di');
    const { OpenApiService } = await import('../../src/service');

    const instance = await DependencyRegistry.getInstance(OpenApiService);
    const spec = await instance.spec;
    CliUtil.pluginResponse(spec);
  }
}

export function entry() {
  return GenerateUtil.generate();
}