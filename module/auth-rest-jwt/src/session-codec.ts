import { Inject, Injectable } from '@travetto/di';
import { FilterContext, RestCodec, RestCodecValue } from '@travetto/rest';
import { RestJWTConfig } from './config';

/**
 * Session codec via JWT
 */
@Injectable()
export class JWTSessionCodec implements RestCodec<string> {

  @Inject()
  config: RestJWTConfig;

  value: RestCodecValue<string>;

  postConstruct(): void {
    this.value = new RestCodecValue({
      header: this.config.mode !== 'cookie' ? this.config.header : undefined!,
      cookie: this.config.mode !== 'header' ? this.config.cookie : undefined,
      headerPrefix: this.config.headerPrefix
    });
  }

  /**
   * Read id from jwt token
   */
  async decode(ctx: FilterContext): Promise<string | undefined> {
    const token = this.value.readValue(ctx.req);
    if (token) {
      return (await this.config.signer.verify(token)).sessionId;
    }
  }

  /**
   * Nothing to store, rely on jwt for everything
   */
  encode(ctx: FilterContext, data: string | undefined): Promise<void> | void { }
}