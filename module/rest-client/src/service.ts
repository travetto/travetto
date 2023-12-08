import { setImmediate } from 'timers/promises';

import { AutoCreate, Inject, Injectable } from '@travetto/di';
import { SchemaRegistry } from '@travetto/schema';
import { RuntimeIndex, RuntimeManifest, path } from '@travetto/manifest';
import { ControllerRegistry, ControllerVisitUtil } from '@travetto/rest';
import { Env } from '@travetto/base';
import { RootRegistry } from '@travetto/registry';

import { RestClientConfig, RestClientProvider } from './config';

import { ClientGenerator } from './provider/base';
import { AngularClientGenerator } from './provider/angular';
import { FetchClientGenerator } from './provider/fetch';

@Injectable()
export class RestClientGeneratorService implements AutoCreate {

  @Inject()
  config: RestClientConfig;

  providers: ClientGenerator[];

  buildGenerator({ type, output, moduleName, options }: RestClientProvider): ClientGenerator {
    output = path.resolve(
      RuntimeManifest.workspacePath,
      output.startsWith('@') ? RuntimeIndex.mainModule.sourceFolder : '.',
      output
    );

    switch (type) {
      case 'angular': return new AngularClientGenerator(output, moduleName, options);
      case 'fetch':
      case 'fetch-node':
      case 'fetch-web': return new FetchClientGenerator(output, moduleName, { ...options, node: !type.includes('web') });
    }
  }

  async renderClient(provider: RestClientProvider | ClientGenerator): Promise<void> {
    await ControllerVisitUtil.visit(provider instanceof ClientGenerator ? provider : this.buildGenerator(provider));
  }

  async postConstruct(): Promise<void> {
    if (!Env.dynamic || !this.config.providers.length) {
      return;
    }

    this.providers = this.config.providers.map(x => this.buildGenerator(x)).filter(x => !!x);

    if (!this.providers.length) {
      return;
    }

    SchemaRegistry.on(async ev => {
      await setImmediate();

      if (ev.type === 'removing') {
        for (const el of this.providers) {
          if (await el.onSchemaRemove?.(ev.prev!)) {
            await el.onComplete?.();
          }
        }
      } else if (ev.type === 'changed') {
        for (const el of this.providers) {
          if (await el.onSchemaAdd?.(ev.curr!)) {
            await el.onComplete?.();
          }
        }
      }
    });

    ControllerRegistry.on(async ev => {
      await setImmediate();

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

    // If a file is changed, but doesn't emit classes, re-run whole file
    RootRegistry.onNonClassChanges(async file => {
      // Initial render
      for (const p of this.providers) {
        if (p.seenFile(file)) {
          await this.renderClient(p);
        }
      }
    });

    // Initial render
    for (const p of this.providers) {
      await this.renderClient(p);
    }
  }
}