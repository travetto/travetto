import { DockerPackFactory } from './bin/types';
import { PackUtil } from './bin/util';

export const factory: DockerPackFactory = cfg => `
FROM ${cfg.dockerImage}
${PackUtil.generateDockerUserCommand(cfg)}
WORKDIR /app
COPY . .
${cfg.dockerPort?.map(port => `EXPOSE ${port}`).join('\n') ?? ''}
ENTRYPOINT ["/app/${cfg.mainName}.sh"]
`;