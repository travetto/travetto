/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';

export const text = <>
    <c.StdHeader />
    The repo module aims to provide some simple mono-repo based tools, primarily around module publishing.  The module provides two cli operations:

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

    Publish @travetto/asset,@travetto/asset-rest,@travetto/auth,@travetto/auth-model,@travetto/auth-rest,@travetto/auth-rest-context,@travetto/auth-rest-jwt,@travetto/auth-rest-passport,@travetto/auth-rest-session,...
`} language='bash' />
    </c.Section>

    <c.Section title='CLI - Publish'>
        The publish functionality is relatively naive, but consistent.  The code will look at all modules in the mono-repo and check the listed version against what is available in the npm registry.  If the local version is newer, it is a candidate for publishing.

        <c.Execution title='Publish execution' cmd='trv' args={['repo:publish', '-h']} />

        By default the tool will execute a dry run only, and requires passing a flag to disable the dry run.

        <c.Terminal title='Publishing changes' src='npx trv repo:publish --no-dry-run' />

        If no modules are currently changed, then the command will indicate there is no work to do, and exit gracefully.
    </c.Section>
</>;