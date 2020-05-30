import { ExecUtil, FsUtil } from '../../module/boot/src';
import { FrameworkUtil } from '../../module/boot/src/framework';

type Service = { name: string, version: string, port: number, image: string, env: Record<string, string> };

function log(svc: Service, message: string) {
  const prefix = `[${svc.name}@${svc.version}]`;
  console.log(prefix.padEnd(30), message);
}

async function isRunning(svc: Service) {
  const p = ExecUtil.spawn('netstat', ['-lan']);
  return (await p.result).stdout.includes(`:${svc.port}`);
}

async function getContainerId(svc: Service) {
  const p = ExecUtil.spawn('docker', ['ps', '-q', '--filter', `label=trv-${svc.name}`]);
  return (await p.result).stdout.trim();
}

async function stop(svc: Service) {
  if (await isRunning(svc)) {
    log(svc, 'Stopping');
    const pid = await getContainerId(svc);
    if (pid) {
      await ExecUtil.spawn('docker', ['kill', pid]).result;
    } else {
      log(svc, 'Unable to kill, not started by this script');
    }
  } else {
    log(svc, 'Skipping, already stopped');
  }
}

async function start(svc: Service) {
  if (!(await isRunning(svc))) {
    log(svc, 'Starting');
    const envArr = [...Object.entries(svc.env || {})].flatMap(([k, v]) => ['-e', `${k}=${v}`]);
    await ExecUtil.spawn('docker', [
      'run', '-it', '--rm', '-d',
      '-l', `trv-${svc.name}`,
      '-p', `${svc.port}:${svc.port}`,
      ...envArr,
      svc.image
    ]).result;
  } else {
    log(svc, 'Skipping, already running');
  }
}

function status(svc: Service) {
  const running = isRunning(svc);
  const pid = getContainerId(svc);
  log(svc, !running ? 'Not running' : (pid ? 'Started' : 'Started, but not managed'));
}

export async function run(mode: 'start' | 'stop' | 'restart' | 'status') {

  const services = FrameworkUtil
    .scan(x => /support\/service[.].*?[.]json/.test(x), FsUtil.resolveUnix(process.cwd(), 'module'))
    .filter(x => x.stats.isFile() && !x.module.includes('node_modules'))
    .map(x => require(x.file) as Service);

  const all = services.map(async svc => {
    if (mode === 'stop' || mode === 'restart') {
      stop(svc);
    }
    if (mode === 'start' || mode === 'restart') {
      start(svc);
    }
    if (mode === 'status') {
      status(svc);
    }

  });

  await Promise.all(all);
}