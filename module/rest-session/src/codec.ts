import { Injectable, Inject } from '@travetto/di';
import { FilterContext, RestCodec, RestCodecValue } from '@travetto/rest';
import { RestSessionConfig } from './config';

/**
 * Rest codec for reading/writing session id
 * @concrete ./internal/types#SessionCodecTarget
 */
export interface SessionCodec extends RestCodec<string> { }

@Injectable()
export class DefaultSessionCodec implements SessionCodec {

  @Inject()
  config: RestSessionConfig;

  value: RestCodecValue<string>;

  postConstruct(): void {
    this.value = new RestCodecValue({
      cookie: this.config.transport === 'cookie' ? this.config.keyName : undefined!,
      header: this.config.transport === 'header' ? this.config.keyName : undefined,
    });
  }

  encode(ctx: FilterContext, key: string | undefined): Promise<void> | void {
    this.value.writeValue(ctx.res, key);
  }

  decode(ctx: FilterContext): string | Promise<string | undefined> | undefined {
    return this.value.readValue(ctx.req);
  }
}
