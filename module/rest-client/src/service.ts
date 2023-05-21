import { Inject, Injectable } from '@travetto/di';
import { RestClientConfig } from './config';
import { ControllerRegistry, ControllerVisitor } from '@travetto/rest';
import { AngularClientGenerator } from './provider/angular';
import { FetchClientGenerator } from './provider/fetch';

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

    ControllerRegistry.on(ev => {
      if (ev.type === 'removing') {
        for (const el of this.providers) {
          el.onControllerRemove?.(ev.prev!);
        }
      }
    });
  }
}