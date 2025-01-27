import { Inject, Injectable } from '@travetto/di';
import { FilterContext, RestCodec } from '@travetto/rest';
import { RestJWTConfig } from './config';

/**
 * Session codec via JWT
 */
@Injectable()
export class JWTSessionCodec implements RestCodec<string> {

  @Inject()
  config: RestJWTConfig;

  /**
   * Read id from jwt token
   */
  async decode(ctx: FilterContext): Promise<string | undefined> {
    const token = this.config.value.readValue(ctx.req);
    if (token) {
      return (await this.config.signer.verify(token)).sessionId;
    }
  }

  /**
   * Nothing to store, rely on jwt for everything
   */
  encode(ctx: FilterContext, data: string | undefined): Promise<void> | void { }
}