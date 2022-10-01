import * as fs from 'fs/promises';

import { FsUtil, Host, PathUtil } from '@travetto/boot';
import { CliCommand, OptionConfig, ListOptionConfig } from '@travetto/cli/src/command';

type Options = {
  app: OptionConfig<string>;
  image: OptionConfig<string>;
  port: OptionConfig<number>;
  add: ListOptionConfig<string>;
  output: OptionConfig<string>;
};

export class PackDockerExportCommand extends CliCommand<Options> {

  name = 'pack:docker-export';

  getOptions(): Options {
    return {
      app: this.option({ desc: 'The application target to run', def: 'rest' }),
      image: this.option({ desc: 'Docker image to extend', def: 'node:16-alpine' }),
      port: this.intOption({ desc: 'Expose port', def: 3000 }),
      add: this.listOption({ desc: 'Files to include' }),
      output: this.option({ desc: 'Docker file name', def: 'Dockerfile' })
    };
  }

  async action(...args: unknown[]): Promise<void> {
    const files = [Host.PATH.src, Host.PATH.bin, Host.PATH.support, Host.PATH.resources, 'package.json', 'package-lock.json', ...this.cmd.add]
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
      await fs.writeFile(this.cmd.output, content, { encoding: 'utf8' });
    }
  }
}