import { promises as fs } from 'fs';

import { ExecUtil, PathUtil } from '@travetto/boot';
import { color } from '@travetto/cli/src/color';

import { CommonConfig, PackOperation } from '../lib/types';
import { PackUtil } from '../lib/util';

export interface DockerConfig extends CommonConfig {
  image: string;
  tag: string[];
  app?: string;
  port?: (string | number)[];
  env: Record<string, string | number | boolean>;
}

export const Docker: PackOperation<DockerConfig> = {
  key: 'docker',
  title: 'Docker-izing',
  context(cfg: DockerConfig) {
    return `[image=${cfg.image}, port=${cfg.port}]`;
  },
  extend(a: DockerConfig, b: Partial<DockerConfig>) {
    return {
      ...PackUtil.commonExtend(a, b),
      image: b.image ?? a.image,
      app: b.app ?? a.app,
      tag: b.tag ?? a.tag ?? ['app'],
      port: b.port ?? a.port,
      env: { ...(b.env ?? {}), ...a.env }
    };
  },
  /**
  * Dockerize workspace with flags
  */
  async* exec({ workspace, image, port, tag, env, app = 'rest' }: DockerConfig) {
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
    const args = ['build', ...tag.flatMap(x => ['-t', x]), '.'];

    const { result } = ExecUtil.spawn('docker', args, { cwd: ws, stdio: [0, 'pipe', 2] });
    await result;

    yield color`${{ success: 'Successfully' }} containerized project`;
  }
};