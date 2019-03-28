import { Injectable, Inject } from '@travetto/di';
import { ModelService, Model } from '@travetto/model';

import { Session, SessionStore } from '..';

@Model()
export class SessionModel extends Session {
  id?: string;
  expiresAt: number | undefined;
  action?: 'create' | 'destroy' | 'modify';
  maxAge?: number;
  signature?: string;
  issuedAt: number;
  payload: any;
  payloadData: string;
}

@Injectable({ target: ModelStore })
export class ModelStore extends SessionStore {

  @Inject()
  modelService: ModelService;

  async load(id: string) {
    const res = await this.modelService.getAllByQuery(SessionModel, { id } as any);
    if (res.length === 1) {
      const out = res[0];
      if (out.payloadData && !out.payload) {
        try {
          out.payload = JSON.parse(out.payloadData);
        } catch (e) { }
      }
      if (out.payload) {
        return out;
      }
    }
  }
  async store(data: SessionModel) {
    data.payloadData = JSON.stringify(data.payload);
    delete data.payload;
    await this.modelService.saveOrUpdate(SessionModel, data, { id: data.id } as any);
  }
  async destroy(session: SessionModel) {
    return (await this.modelService.deleteById(SessionModel, session.id!)) > 0;
  }
}