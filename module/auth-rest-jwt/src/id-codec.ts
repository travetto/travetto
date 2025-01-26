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

  value: RestCodecValue;

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
      const value = await this.config.verifyToken(token);
      return value.details?.sessionId;
    }
  }

  // Do nothing
  encode(ctx: FilterContext, data: string | undefined): Promise<void> | void { }
}