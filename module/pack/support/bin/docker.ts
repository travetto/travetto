import fs from 'fs/promises';

import { path, RootIndex } from '@travetto/manifest';
import { Env, ExecUtil } from '@travetto/base';
import { cliTpl } from '@travetto/cli';

import { CommonConfig, PackOperation } from './types';
import { PackUtil } from './util';

export interface DockerConfig extends CommonConfig {
  image: string;
  tag: string[];
  name?: string;
  app?: string;
  port?: (string | number)[];
  env: Record<string, string | number | boolean>;
  builder?: (cfg: DockerConfig) => string;
  registry?: string;
  push?: boolean;
}

const dockerFileBuilder = ({ image, port, app = 'rest', env }: DockerConfig): string => `
FROM ${image}
WORKDIR /app
COPY . .
${Object.entries(env).map(([k, v]) => `ENV ${k} "${v}"`).join('\n')}
${(port ?? []).map(x => `EXPOSE ${x}`).join('\n')}
CMD ["./trv", "run", "${app}"]
`;

export const Docker: PackOperation<DockerConfig, 'docker'> = {
  key: 'docker',
  title: 'Docker-izing',
  context(cfg: DockerConfig) {
    return `[image=${cfg.image}, port=${cfg.port}]`;
  },
  defaults: {
    name: RootIndex.mainPackage.name.replace('@', ''),
    image: 'node:18-alpine3.16',
    builder: dockerFileBuilder,
    port: [],
    tag: ['latest']
  },
  overrides: {
    image: Env.get('PACK_DOCKER_IMAGE') || undefined,
    name: Env.get('PACK_DOCKER_NAME') || undefined,
    app: Env.get('PACK_DOCKER_APP') || undefined,
    registry: Env.get('PACK_DOCKER_REGISTRY') || undefined,
    push: Env.getBoolean('PACK_DOCKER_PUSH'),
    port: Env.getList('PACK_DOCKER_PORT'),
    tag: Env.getList('PACK_DOCKER_TAG')
  },
  extend(src: Partial<DockerConfig>, dest: Partial<DockerConfig>): Partial<DockerConfig> {
    return {
      image: src.image ?? dest.image,
      app: src.app ?? dest.app,
      name: src.name ?? dest.name,
      builder: src.builder ?? dest.builder,
      tag: src.tag ?? dest.tag,
      port: src.port ?? dest.port,
      registry: src.registry ?? dest.registry,
      env: { ...(src.env ?? {}), ...(dest.env ?? {}) },
      push: src.push ?? dest.push
    };
  },
  buildConfig(configs: Partial<DockerConfig>[]): DockerConfig {
    return PackUtil.buildConfig(this, configs);
  },
  /**
  * Dockerize workspace with flags
  */
  async* exec(cfg: DockerConfig) {
    const { builder, workspace, push, image, tag, name, registry } = cfg;

    const ws = path.resolve(workspace);

    yield 'Building Dockerfile';

    await fs.writeFile(path.resolve(ws, 'Dockerfile'), builder!(cfg), { encoding: 'utf8' });

    yield 'Pulling Base Image';
    await ExecUtil.spawn('docker', ['pull', image]).result;

    yield 'Building Docker Container';
    const tags = tag.map(x => registry ? `${registry}/${name}:${x}` : `${name}:${x}`);
    const args = ['build', ...tags.flatMap(x => ['-t', x]), '.'];

    await ExecUtil.spawn('docker', args, { cwd: ws, stdio: [0, 'pipe', 2] }).result;

    if (push) {
      yield 'Pushing Tags';
      await ExecUtil.spawn('docker', ['image', 'push', ...tags]).result;
    }

    yield cliTpl`${{ success: 'Successfully' }} containerized project`;
  }
};