import { Principal } from '@travetto/auth';
import { PrincipalCodec } from '@travetto/auth-web';
import { Injectable } from '@travetto/di';
import { HttpContext } from '@travetto/web';

@Injectable()
export class CustomCodec implements PrincipalCodec {
  decode(ctx: HttpContext): Promise<Principal | undefined> | Principal | undefined {
    const userId = ctx.req.headerFirst('USER_ID');
    if (userId) {
      let p: Principal | undefined;
      // Lookup user from db, remote system, etc.,
      return p;
    }
    return;
  }
  encode(ctx: HttpContext, data: Principal | undefined): Promise<void> | void {
    if (data) {
      ctx.res.setHeader('USER_ID', data.id);
    }
  }
}