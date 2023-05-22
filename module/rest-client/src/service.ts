import { Inject, Injectable } from '@travetto/di';
import { RestClientConfig } from './config';
import { ControllerRegistry, ControllerVisitor } from '@travetto/rest';
import { AngularClientGenerator } from './provider/angular';
import { FetchClientGenerator } from './provider/fetch/fetch';
import { SchemaRegistry } from '@travetto/schema';

@Injectable()
export class RestClientGeneratorService {

  @Inject()
  config: RestClientConfig;

  providers: ControllerVisitor[];

  async postConstruct(): Promise<void> {
    this.providers = this.config.providers.map(x => {
      switch (x.type) {
        case 'angular': return new AngularClientGenerator(x.output);
        case 'fetch': return new FetchClientGenerator(x.output);
      }
    });

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
  }
}