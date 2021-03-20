import '@arcsine/nodesh';
import * as path from 'path';
import { execSync } from 'child_process';

const MOD = process.argv[2];
const ROOT = path.resolve(__dirname, '..', '..', 'module', MOD);

const VER = require(`${ROOT}/package.json`).version;
const TAG = `@travetto/${MOD}@${VER}`;

execSync(`git tag ${TAG}`, { encoding: 'utf8', stdio: [0, 1, 2] });
const tagFmt = (k: string) => execSync(`git show ${TAG} --format=%${k} -s`, { encoding: 'utf8' });

const env = {
  GIT_AUTHOR_NAME: tagFmt('aN'),
  GIT_AUTHOR_EMAIL: tagFmt('aE'),
  GIT_AUTHOR_DATE: tagFmt('aD'),
  GIT_COMMITTER_NAME: tagFmt('cN'),
  GIT_COMMITTER_EMAIL: tagFmt('cE'),
  GIT_COMMITTER_DATE: tagFmt('cD'),
};

// Update Tag
execSync(`git tag -a -m ${TAG} -f ${TAG} ${TAG}`, { env, stdio: [0, 1, 2] });
execSync('git push --tags --force', { env, stdio: [0, 1, 2] });

// Publish
execSync('npm publish', { env, stdio: [0, 1, 2] });