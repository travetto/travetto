import { promises as fs } from 'fs';
import { ExecUtil, FsUtil } from '@travetto/boot';
import { color } from '@travetto/cli/src/color';

import { CommonConfig, PackOperation } from '../lib/types';

export interface DockerConfig extends CommonConfig {
  image: string;
  tag: string[];
  port?: string[];
  env: Record<string, string>;
}

export const Docker: PackOperation<DockerConfig> = {
  key: 'docker',
  title: 'Docker-izing',
  flags: [
    ['-w --workspace [workspace]', 'Workspace directory', undefined, 'workspace'],
    ['-i --image [image]', 'Docker Image to extend', undefined, 'image'],
    ['-t --tag [tag]', 'Image Tag', undefined, 'tag'],
    ['-p --port [port]', 'Image Port', undefined, 'port']
  ],
  extend(a: DockerConfig, b: Partial<DockerConfig>) {
    return {
      active: b.active ?? a.active,
      workspace: b.workspace ?? a.workspace,
      image: b.image ?? a.image,
      tag: b.tag ?? a.tag ?? ['app'],
      port: b.port ?? a.port,
      env: { ...(b.env ?? {}), ...a.env }
    };
  },
  /**
  * Zip workspace with flags
  */
  async* exec({ workspace, image, port, tag, env }: DockerConfig) {
    const ws = FsUtil.resolveUnix(workspace);

    yield 'Building Dockerfile';
    await fs.writeFile(FsUtil.resolveUnix(ws, 'Dockerfile'), `
  FROM ${image}
  WORKDIR /app
  COPY . .
  ${Object.entries(env).map(([k, v]) => `ENV ${k} "${v}"`).join('\n')}
  ${(port ?? []).map(x => `EXPOSE ${x}`).join('\n')}
  CMD ["node", "./node_modules/.bin/trv", "run", "rest"]
    `, { encoding: 'utf8' });

    yield 'Pulling Base Image';
    await ExecUtil.spawn(`docker`, ['pull', image]).result;

    yield 'Building Docker Container';
    const args = ['build', ...tag.flatMap(x => ['-t', x]), '.'];

    const { result } = ExecUtil.spawn(`docker`, args, { cwd: ws, stdio: [0, 'pipe', 2] });
    await result;

    yield color`${{ success: 'Successfully' }} containerized project`;
  }
};