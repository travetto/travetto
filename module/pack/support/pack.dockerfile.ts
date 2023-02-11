import { DockerPackFactory } from './bin/types';

export const factory: DockerPackFactory = cfg => `
FROM ${cfg.dockerImage}
WORKDIR /app
COPY . .
${cfg.dockerPort.map(port => `EXPOSE ${port}`).join('\n')}
ENTRYPOINT ["/app/${cfg.entryCommand}.sh"]
`;