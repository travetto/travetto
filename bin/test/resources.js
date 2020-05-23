#!/usr/bin/env node

const { ScanFs, ExecUtil } = require('../../module/boot/src');

function log(name, version, message) {
  const prefix = `[${name}@${version}]`;
  console.log(prefix.padEnd(30), message);
}

async function isRunning(port) {
  const p = ExecUtil.spawn('netstat', ['-lan']);
  return (await p.result).stdout.includes(`:${port}`);
}

async function getContainerId(name) {
  const p = ExecUtil.spawn('docker', ['ps', '-q', '--filter', `label=trv-${name}`]);
  return (await p.result).stdout.trim();
}

async function stop({ name, version, port, image, env }) {
  if (await isRunning(port)) {
    log(name, version, 'Stopping');
    const pid = await getContainerId(name);
    if (pid) {
      await ExecUtil.spawn('docker', ['kill', pid]).result;
    } else {
      log(name, version, 'Unable to kill, not started by this script');
    }
  } else {
    log(name, version, 'Skipping, already stopped');
  }
}

async function start({ name, version, port, image, env }) {
  if (!(await isRunning(port))) {
    log(name, version, 'Starting');
    const envArr = [...Object.entries(env || {})].flatMap(([k, v]) => ['-e', `${k}=${v}`]);
    await ExecUtil.spawn('docker', ['run', '-it', '--rm', '-d', '-l', `trv-${name}`, '-p', `${port}:${port}`, ...envArr, image]).result;
  } else {
    log(name, version, 'Skipping, already running');
  }
}

function status({ name, version, port, image, env }) {
  const running = isRunning(port);
  const pid = getContainerId(name);
  log(name, version, !running ? 'Not running' : (pid ? 'Started' : 'Started, but not managed'));
}

async function main(mode) {
  const services = ScanFs
    .scanFramework(x => /support\/service[.].*?[.]json/.test(x))
    .filter(x => x.stats.isFile() && !x.module.includes('node_modules'))
    .map(x => require(x.file));

  const all = services.map(async service => {
    if (mode === 'stop' || mode === 'restart') {
      stop(service);
    }
    if (mode === 'start' || mode === 'restart') {
      start(service);
    }
    if (mode === 'status') {
      status(service);
    }

  });

  await Promise.all(all);
}

main(process.argv[2]);