import { AuthContext } from '@travetto/auth';

export class AuthRequestAdapter<U = { [key: string]: any }> {

  private ctx?: AuthContext;

  get context() {
    if (!this.ctx) {
      this.ctx = new AuthContext({} as any);
    }
    return this.ctx;
  }
  set context(ctx: AuthContext | undefined) {
    this.ctx = ctx;
  }
  get principal() {
    return this.context!.principal;
  }
  get principalDetails() {
    return this.context!.principalDetails;
  }
  get permissions() {
    return this.context!.permissions;
  }
  async logout() {
    this.context = undefined;
  }
  async updatePrincipalDetails(details: U) {
    this.context!.updatePrincipalDetails(details);
  }
}