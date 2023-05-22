import { AutoCreate, Inject, Injectable } from '@travetto/di';
import { SchemaRegistry } from '@travetto/schema';
import { RootIndex, path } from '@travetto/manifest';
import { ControllerRegistry, ControllerVisitUtil, ControllerVisitor } from '@travetto/rest';

import { RestClientConfig } from './config';
import { AngularClientGenerator } from './provider/angular';
import { FetchClientGenerator } from './provider/fetch';

@Injectable()
export class RestClientGeneratorService implements AutoCreate {

  @Inject()
  config: RestClientConfig;

  providers: ControllerVisitor[];

  async postConstruct(): Promise<void> {
    this.providers = this.config.providers.map(x => {

      x.output = path.resolve(
        RootIndex.manifest.workspacePath,
        RootIndex.mainModule.sourceFolder,
        x.output
      );

      switch (x.type) {
        case 'angular': return new AngularClientGenerator(x.output);
        case 'fetch': return new FetchClientGenerator(x.output);
      }
    });

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
      await ControllerVisitUtil.visit(p);
    }
  }
}