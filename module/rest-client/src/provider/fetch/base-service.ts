export type IServiceConfig = {

};

export abstract class BaseService {
  config: IServiceConfig;

  constructor(cfg: IServiceConfig) {
    this.config = cfg;
  }


}