import { GlobalEnvConfig } from '@travetto/base';
import { CliCommand, CliCommandShape, CliValidationResultError } from '@travetto/cli';
import { DependencyRegistry } from '@travetto/di';
import { RootIndex } from '@travetto/manifest';
import { RootRegistry } from '@travetto/registry';
import { Ignore } from '@travetto/schema';

/**
 * Run client rest operation
 */
@CliCommand({ fields: ['module', 'env'] })
export class CliRestClientCommand implements CliCommandShape {

  @Ignore()
  module: string;

  @Ignore()
  env: string;

  envInit(): GlobalEnvConfig {
    return {
      debug: false
    };
  }

  async main(type: 'fetch' | 'angular' | 'config', output?: string): Promise<void> {
    this.module ||= RootIndex.mainModuleName;

    if (type !== 'config' && !output) {
      throw new CliValidationResultError([
        { message: 'output is required when type is fetch or angular', source: 'arg' }
      ]);
    }

    await RootRegistry.init();
    const { RestClientGeneratorService } = await import('../src/service.js');
    const genService = await DependencyRegistry.getInstance(RestClientGeneratorService);

    switch (type) {
      case 'config': {
        for (const provider of genService.providers) {
          await genService.renderProvider(provider);
        }
        break;
      }
      case 'fetch': {
        const { FetchClientGenerator } = await import('../src/provider/fetch.js');
        await genService.renderProvider(new FetchClientGenerator(output!));
        console.log!(`Generated fetch client at ${output}`);
        break;
      }
      case 'angular': {
        const { AngularClientGenerator } = await import('../src/provider/angular.js');
        await genService.renderProvider(new AngularClientGenerator(output!));
        console.log!(`Generated angular client at ${output}`);
        break;
      }
    }
  }
}