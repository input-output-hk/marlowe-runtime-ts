# TS-SDK Versioning and Release Process

## Versioning System

The TS-SDK follows a versioning system where, after version 1, it aligns with semantic release standards, utilizing the format: `Major.Minor.Patch`. The versioning rules are as follows:

- **Major Version:** Incremented when a breaking change is introduced.
- **Minor Version:** Incremented when a new feature is added.
- **Patch Version:** Incremented when a bug is fixed.

Before version 1, the TS-SDK adheres to beta rules:

- **Beta Versions:** While in the 0.x.x versions, if a breaking change is introduced, the Major version is not incremented; instead, the Minor version is increased. Additionally, these versions will end with the `-beta` suffix, for example `0.4.0-beta`.

## Release Checklist

### Pre-release Checklist:

1. **Candidate Commit:**

      - Identify a candidate commit on the `main` branch.

2. **CI Checks:**

      - Ensure that all Continuous Integration (CI) checks pass on the candidate commit.

3. **Version Number Update:**

      - Update version numbers in project metadata.

4. **QA Approval:**

      - Obtain approval from the Quality Assurance (QA) team.

### Release Checklist:

1. **Release Notes:**

      - Generate release notes from the `changelog.d` folder(s).
      - This can be done using `scriv collect` from the nix shell.

2. **Release Tag:**

      - Use git to create and push a release tag.
      - `git tag -a 0.4.0-beta -m "Release v0.4.0-beta"`
      - `git push --tags`

3. **Packages Build and Publish:**

      - Build and publish packages from the release tag.
      - `npm publish --workspaces` (for the moment @hrajchert and @nhenin have publish access)
            - If this is a release candidate (e.g. `0.3.0-beta-rc`), then we need to add a `--tag` to avoid overriding `latest` (`npm publish --workspaces --tag rc`).

4. **GitHub Release:**

      - Publish release(s) on GitHub along with release notes from the collected changelog.

5. **Documentation:**

      - Manually trigger the `deploy docs` github action

6. **Announcement:**

      - Contact the marketing and devrel team to announce the release.

## Note:

      - The release process is currently manual.
