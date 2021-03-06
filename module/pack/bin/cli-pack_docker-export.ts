import { FsUtil, PathUtil } from '@travetto/boot/src';
import { BasePlugin } from '@travetto/cli/src/plugin-base';
import * as fs from 'fs';

export class PackDockerExportPlugin extends BasePlugin {

  name = 'pack:docker-export';

  getOptions() {
    return {
      app: this.option({ desc: 'The application target to run', def: 'rest' }),
      image: this.option({ desc: 'Docker image to extend', def: 'node:16-alpine' }),
      port: this.intOption({ desc: 'Expose port', def: 3000 }),
      add: this.listOption({ desc: 'Files to include' }),
      output: this.option({ desc: 'Docker file name', def: 'Dockerfile' })
    };
  }

  async action(...args: any[]) {
    const files = ['src', 'bin', 'support', 'resources', 'package.json', 'package-lock.json', ...this.cmd.add]
      .filter(x => FsUtil.existsSync(PathUtil.resolveUnix(x)));

    const content = `
FROM ${this.cmd.image} as build
WORKDIR /build
${files.map(x => `COPY ${x} ${x}`).join('\n')}
ENV NODE_OPTIONS "--no-deprecation"
RUN npm ci
RUN npx trv pack:assemble -w /app

FROM ${this.cmd.image} as scratch
COPY --from=build /app /app
EXPOSE ${this.cmd.port}
WORKDIR  /app
ENV NODE_OPTIONS "--no-deprecation"
CMD ["node", "./node_modules/@travetto/cli/bin/trv", "run", "${this.cmd.app}"]
`;

    if (this.cmd.output === '-' || this.cmd.output === '/dev/stdout' || !this.cmd.output) {
      console.log(content);
    } else {
      await fs.promises.writeFile(this.cmd.output, content, { encoding: 'utf8' });
    }
  }
}