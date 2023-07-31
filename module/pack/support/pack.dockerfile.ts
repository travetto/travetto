import { DockerPackFactory } from './bin/types';
import { PackConfigUtil } from './bin/config-util';

export const factory: DockerPackFactory = cfg => `
FROM ${cfg.dockerImage}
${PackConfigUtil.dockerUserCommand(cfg)}
WORKDIR /app
COPY . .
${cfg.dockerPort?.map(port => `EXPOSE ${port}`).join('\n') ?? ''}
ENTRYPOINT ["/app/${cfg.mainName}.sh"]
`;