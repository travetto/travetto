import { DockerPackConfig, DockerPackFactory } from './bin/types';

function buildRuntimeUser(cfg: DockerPackConfig): string {
  const { user, group, uid, gid } = cfg.dockerRuntimeUser;
  if (user !== 'root') {
    return [
      '',
      `RUN addgroup -g ${gid} ${group} && adduser -S -u ${uid} ${user} ${group}`,
      `USER ${user}`
    ].join('\n');
  } else {
    return '';
  }
}

export const factory: DockerPackFactory = cfg => `
FROM ${cfg.dockerImage}
${buildRuntimeUser(cfg)}
WORKDIR /app
COPY . .
${cfg.dockerPort?.map(port => `EXPOSE ${port}`).join('\n') ?? ''}
ENTRYPOINT ["/app/${cfg.mainName}.sh"]
`;