import { ApplicationParameter, AppDecorator, Application as ParentApplication } from '@travetto/app';

export function Application(
  name: string,
  config?: AppDecorator,
  params?: (Partial<ApplicationParameter> & { name: string })[]
) {
  if (!config) {
    config = {};
  }
  if (!('watchable' in config)) {
    config.watchable = true;
  }
  config.description = `[Rest Server] ${config.description ?? ''}`.trim();
  return ParentApplication(name, config, params);
}