import { AutoCreate, Inject, Injectable } from '@travetto/di';
import { SchemaRegistry } from '@travetto/schema';
import { RootIndex, path } from '@travetto/manifest';
import { ControllerRegistry, ControllerVisitUtil } from '@travetto/rest';
import { GlobalEnv } from '@travetto/base';

import { RestClientConfig, RestClientProvider } from './config';

import { ClientGenerator } from './provider/base';
import { AngularClientGenerator } from './provider/angular';
import { NodeFetchClientGenerator } from './provider/fetch-node';
import { WebFetchClientGenerator } from './provider/fetch-web';


@Injectable()
export class RestClientGeneratorService implements AutoCreate {

  @Inject()
  config: RestClientConfig;

  providers: ClientGenerator[];

  buildGenerator({ type, output, moduleName, options }: RestClientProvider): ClientGenerator {
    output = path.resolve(
      RootIndex.manifest.workspacePath,
      output.startsWith('@') ? RootIndex.mainModule.sourceFolder : '.',
      output
    );

    switch (type) {
      case 'angular': return new AngularClientGenerator(output, moduleName, options);
      case 'fetch':
      case 'fetch-node': return new NodeFetchClientGenerator(output, moduleName, options);
      case 'fetch-web': return new WebFetchClientGenerator(output, moduleName, options);
    }
  }

  async renderClient(provider: RestClientProvider | ClientGenerator): Promise<void> {
    await ControllerVisitUtil.visit(provider instanceof ClientGenerator ? provider : this.buildGenerator(provider));
  }

  async postConstruct(): Promise<void> {
    if (!GlobalEnv.dynamic || !this.config.providers.length) {
      return;
    }

    this.providers = this.config.providers.map(x => this.buildGenerator(x)).filter(x => !!x);

    if (!this.providers.length) {
      return;
    }

    SchemaRegistry.on(async ev => {
      if (ev.type === 'removing') {
        for (const el of this.providers) {
          if (await el.onSchemaRemove?.(ev.prev!)) {
            await el.onComplete?.();
          }
        }
      } else if (ev.type === 'added' || ev.type === 'changed') {
        for (const el of this.providers) {
          if (await el.onSchemaAdd?.(ev.curr!)) {
            await el.onComplete?.();
          }
        }
      }
    });

    ControllerRegistry.on(async ev => {
      if (ev.type === 'removing') {
        for (const el of this.providers) {
          await el.onControllerRemove?.(ev.prev!);
          await el.onComplete?.();
        }
      } else if (ev.type === 'added' || ev.type === 'changed') {
        for (const el of this.providers) {
          await el.onControllerAdd?.(ev.curr!);
          await el.onComplete?.();
        }
      }
    });

    // Initial render
    for (const p of this.providers) {
      await this.renderClient(p);
    }
  }
}