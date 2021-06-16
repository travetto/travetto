import { promises as fs } from 'fs';

import { ExecUtil, Package, PathUtil } from '@travetto/boot';
import { color } from '@travetto/cli/src/color';
import { CliUtil } from '@travetto/cli/src/util';

import { CommonConfig, PackOperation } from '../lib/types';
import { PackUtil } from '../lib/util';

export interface DockerConfig extends CommonConfig {
  image: string;
  tag: string[];
  name?: string;
  app?: string;
  port?: (string | number)[];
  env: Record<string, string | number | boolean>;
  registry?: string;
  push?: boolean;
}

export const Docker: PackOperation<DockerConfig> = {
  key: 'docker',
  title: 'Docker-izing',
  context(cfg: DockerConfig) {
    return `[image=${cfg.image}, port=${cfg.port}]`;
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
  extend(a: DockerConfig, b: Partial<DockerConfig>) {
    return {
      ...PackUtil.commonExtend(a, b),
      image: b.image ?? a.image,
      app: b.app ?? a.app,
      name: b.name ?? a.name ?? Package.name.replace('@', ''),
      tag: b.tag ?? a.tag ?? ['latest'],
      port: b.port ?? a.port ?? [],
      registry: b.registry ?? a.registry,
      env: { ...(b.env ?? {}), ...a.env },
      push: b.push ?? a.push
    };
  },
  /**
  * Dockerize workspace with flags
  */
  async* exec({ workspace, push, image, port, tag, env, name, registry, app = 'rest' }: DockerConfig) {
    const ws = PathUtil.resolveUnix(workspace);

    yield 'Building Dockerfile';
    await fs.writeFile(PathUtil.resolveUnix(ws, 'Dockerfile'), `
  FROM ${image}
  WORKDIR /app
  COPY . .
  ${Object.entries(env).map(([k, v]) => `ENV ${k} "${v}"`).join('\n')}
  ${(port ?? []).map(x => `EXPOSE ${x}`).join('\n')}
  CMD ["node", "./node_modules/@travetto/cli/bin/trv", "run", "${app}"]
    `, { encoding: 'utf8' });

    yield 'Pulling Base Image';
    await ExecUtil.spawn('docker', ['pull', image]).result;

    yield 'Building Docker Container';
    const tags = tag.map(x => registry ? `${registry}/${name}:${x}` : `${name}:${x}`)
    const args = ['build', ...tags.flatMap(x => ['-t', x]), '.'];

    await ExecUtil.spawn('docker', args, { cwd: ws, stdio: [0, 'pipe', 2] }).result;

    if (push) {
      yield `Pushing Tags`
      await ExecUtil.spawn('docker', ['image', 'push', ...tags]).result;
    }

    yield color`${{ success: 'Successfully' }} containerized project`;
  }
};