/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';
import { RuntimeContext } from '@travetto/manifest';

export const text = <>
    <c.StdHeader />
    The repo module aims to provide concise monorepo based tools.  The monorepo support within the {d.library('Travetto')} framework, is based on {d.library('Npm')}/{d.library('Yarn')} workspaces.  This module is not a requirement for monorepo support, but provides some quality of life improvements for:
    <ul>
        <li>Versioning releases</li>
        <li>Publishing releases</li>
        <li>Listing local modules</li>
        <li>Running commands on all workspace modules</li>
    </ul>

    <c.Section title='CLI - Version'>
        The versioning operation will find all the changed modules (and the modules that depend on the changed), and will update the versions in accordance with the user preferences.  The versioning logic is backed by {d.library('Npm')}'s and {d.library('Yarn')}'s versioning functionality and so it is identical to using the tool manually. The determination of what has or hasn't changed is relative to the last versioning commit.

        <c.Execution title='Version execution' cmd='trv' args={['repo:version', '-h']} />

        Level is a standard semver level of: major, minor, patch or prerelease.  The prefix argument only applies to the prerelease and allows for determining the prerelease level.  For example:

        <c.Terminal title='Cutting a release candidate' src='npx trv repo:version prerelease rc' />

        After a release is cut, a new commit will be created that marks the next stable point in the commit history.

        <c.Code title='Versioning Commit' src={`
commit e9dc1a1de9625ab47398997fee6a95dd5a426900
Author: Travetto Framework <travetto.framework@gmail.com>
Date:   Thu Feb 23 17:51:37 2023 -0500
Date:   Thu Feb 23 17:51:37 2023 -0500

    Publish @travetto/asset,@travetto/asset-rest,@travetto/auth,@travetto/auth-model,@travetto/auth-rest,@travetto/auth-rest-jwt,@travetto/auth-rest-passport,@travetto/auth-rest-session,...
`} language='bash' />
    </c.Section>

    <c.Section title='CLI - Publish'>
        The publish functionality is relatively naive, but consistent.  The code will look at all modules in the mono-repo and check the listed version against what is available in the npm registry.  If the local version is newer, it is a candidate for publishing.

        <c.Execution title='Publish execution' cmd='trv' args={['repo:publish', '-h']} />

        By default the tool will execute a dry run only, and requires passing a flag to disable the dry run.

        <c.Terminal title='Publishing changes' src='npx trv repo:publish --no-dry-run' />

        If no modules are currently changed, then the command will indicate there is no work to do, and exit gracefully.
    </c.Section>

    <c.Section title='CLI - List'>
        The listing functionality provides the ability to get the workspace modules in the following formats:
        <c.Execution title='List execution' cmd='trv' args={['repo:list', '-h']} />
        <ul>
            <li>{d.input('list')} - Standard text list, each module on its own line</li>
            <li>{d.input('graph')} - Modules as a digraph, mapping interdependencies</li>
            <li>{d.input('json')} - Graph of modules in JSON form, with additional data (useful for quickly building a dependency graph)</li>
        </ul>

        <c.Execution title='List execution of Monorepo' cmd='trv' args={['repo:list']} config={{ cwd: RuntimeContext.workspace.path }} />
    </c.Section>

    <c.Section title='CLI - Exec'>
        The exec command allows for running commands on all modules, or just changed modules.
        <c.Execution title='Exec execution' cmd='trv' args={['repo:exec', '-h']} />

        The standard format includes prefixed output to help identify which module produced which output.
        <c.Execution title='List execution of Monorepo' cmd='trv' args={['repo:exec', 'pwd']} config={{ cwd: RuntimeContext.workspace.path }} />
    </c.Section>
</>;