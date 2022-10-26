import * as fs from 'fs/promises';
import * as path from 'path';

import { CliUtil, ExecUtil, Package } from '@travetto/boot';

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
CMD ["node", "./node_modules/@travetto/cli/bin/trv", "run", "${app}"]
`;

export const Docker: PackOperation<DockerConfig, 'docker'> = {
  key: 'docker',
  title: 'Docker-izing',
  context(cfg: DockerConfig) {
    return `[image=${cfg.image}, port=${cfg.port}]`;
  },
  defaults: {
    name: Package.main.name.replace('@', ''),
    builder: dockerFileBuilder,
    port: [],
    tag: ['latest']
  },
  overrides: {
    image: process.env.PACK_DOCKER_IMAGE || undefined,
    name: process.env.PACK_DOCKER_NAME || undefined,
    app: process.env.PACK_DOCKER_APP || undefined,
    port: process.env.PACK_DOCKER_PORT ? [process.env.PACK_DOCKER_PORT] : undefined,
    registry: process.env.PACK_DOCKER_REGISTRY || undefined,
    push: CliUtil.toBool(process.env.PACK_DOCKER_PUSH),
    tag: process.env.PACK_DOCKER_TAG ? [process.env.PACK_DOCKER_TAG] : undefined
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

    const ws = path.resolve(workspace).__posix;

    yield 'Building Dockerfile';

    await fs.writeFile(path.resolve(ws, 'Dockerfile').__posix, builder!(cfg), { encoding: 'utf8' });

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

    yield CliUtil.color`${{ success: 'Successfully' }} containerized project`;
  }
};