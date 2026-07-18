/** @jsxImportSource @travetto/doc/support */
import { c, d } from '@travetto/doc';
import { PACKAGE_MANAGERS } from '@travetto/manifest';
import { Runtime } from '@travetto/runtime';

import { RepoExecCommand } from './support/cli.repo_exec.ts';
import { ListModuleCommand } from './support/cli.repo_list.ts';
import { RepoPublishCommand } from './support/cli.repo_publish.ts';
import { RepoVersionCommand } from './support/cli.repo_version.ts';

const PACKAGE_MANAGER_LIST = PACKAGE_MANAGERS.map((manager, i) => (i === 0 ? [d.library(manager.title)] : ['/', d.library(manager.title)]));

export const text = (
  <>
    <c.StdHeader />
    The repo module aims to provide concise monorepo based tools. The monorepo support within the {d.library('Travetto')} framework, is
    backed by the built in functionality of {PACKAGE_MANAGER_LIST}. This module is not a requirement for monorepo support, but provides some
    quality of life improvements for:
    <ul>
      <li>Versioning releases</li>
      <li>Publishing releases</li>
      <li>Listing local modules</li>
      <li>Running commands on all workspace modules</li>
    </ul>
    <c.CliHelpSection commandClass={RepoVersionCommand}>
      The versioning operation will find all the changed modules (and the modules that depend on the changed), and will update the versions
      in accordance with the user preferences. The versioning logic is backed by {PACKAGE_MANAGER_LIST}'s versioning functionality and so it
      is identical to using the tool manually. The determination of what has or hasn't changed is relative to the last versioning commit.
      <c.CliHelpExecution commandClass={RepoVersionCommand} />
      Level is a standard semver level of: major, minor, patch or prerelease. The prefix argument only applies to the prerelease and allows
      for determining the prerelease level. For example:
      <c.Terminal title="Cutting a release candidate" src={`${d.trv} repo:version prerelease rc`} />
      After a release is cut, a new commit will be created that marks the next stable point in the commit history.
      <c.Code
        title="Versioning Commit"
        src={`
commit e9dc1a1de9625ab47398997fee6a95dd5a426900
Author: Travetto Framework <travetto.framework@gmail.com>
Date:   Thu Feb 23 17:51:37 2023 -0500
Date:   Thu Feb 23 17:51:37 2023 -0500

    Publish @travetto/asset,@travetto/asset-web,@travetto/auth,@travetto/auth-model,@travetto/auth-web,@travetto/auth-web-jwt,@travetto/auth-web-passport,@travetto/auth-web-session,...
`}
        language="bash"
      />
    </c.CliHelpSection>
    <c.CliHelpSection commandClass={RepoPublishCommand}>
      The publish functionality is relatively naive, but consistent. The code will look at all modules in the mono-repo and check the listed
      version against what is available in the npm registry. If the local version is newer, it is a candidate for publishing.
      <c.CliHelpExecution commandClass={RepoPublishCommand} />
      By default the tool will execute a dry run only, and requires passing a flag to disable the dry run.
      <c.Terminal title="Publishing changes" src={`${d.trv} repo:publish --no-dry-run`} />
      If no modules are currently changed, then the command will indicate there is no work to do, and exit gracefully.
    </c.CliHelpSection>
    <c.CliHelpSection commandClass={ListModuleCommand}>
      The listing functionality provides the ability to get the workspace modules in the following formats:
      <ul>
        <li>{d.input('list')} - Standard text list, each module on its own line</li>
        <li>{d.input('graph')} - Modules as a digraph, mapping interdependencies</li>
        <li>{d.input('json')} - Graph of modules in JSON form, with additional data (useful for quickly building a dependency graph)</li>
      </ul>
      <c.CliHelpExecution commandClass={ListModuleCommand} />
      <c.Execution
        title="List execution of Monorepo"
        cmd="trv"
        args={['repo:list']}
        config={{ workingDirectory: Runtime.workspace.path }}
      />
    </c.CliHelpSection>
    <c.CliHelpSection commandClass={RepoExecCommand}>
      <c.CliHelpExecution commandClass={RepoExecCommand} />
      The standard format includes prefixed output to help identify which module produced which output.
      <c.Execution
        title="List execution of Monorepo"
        cmd="trv"
        args={['repo:exec', '-w', '1', 'pwd']}
        config={{ workingDirectory: Runtime.workspace.path }}
      />
    </c.CliHelpSection>
  </>
);
