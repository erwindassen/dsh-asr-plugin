# Installation and release channels

This is an unofficial DeepSeek Harness plugin maintained by huliux.
Compatibility and recording limitations are stated in the
[README](../README.md) and [Chinese README](../README.zh-CN.md).

## npm installation

The public package is [@huliux/dsh-asr-plugin](https://www.npmjs.com/package/@huliux/dsh-asr-plugin).
Use the DSH Plugins page, or install the documented stable version into your
chosen Web profile:

```sh
dsh plugin --profile web add --ignore-scripts @huliux/dsh-asr-plugin@0.1.6
```

Plugin 0.1.6 supports DSH 0.2.0-rc.2, 0.2.1-rc.2, 0.2.1-rc.3, 0.2.1-rc.5,
and the 0.2.2 series from rc.1. Later 0.2.2 releases can use the same package.
The manifests in this repository also admit the DSH 0.2.3 series from alpha.1;
the next release carries that admission.
To update the desktop profile, choose **Add plugin** in the app and enter
`@huliux/dsh-asr-plugin@0.1.6`. Web users can rerun the command above.
Restart if requested; the supported versions require no compatibility exemption.
If the desktop installer reports that the package is already installed, use the
verified versioned archive from [GitHub package downloads](#github-package-downloads)
as the **Add plugin** input. Enter its absolute path to update the package while
preserving the existing plugin configuration and meeting data.

Published packages contain the compiled client, native add-ons and signed
recording Helper. Model weights are downloaded separately through settings.
`latest` selects the stable release; `next` selects a preview and can point to an
older version. Check the actual tags before choosing a preview:

```sh
npm view @huliux/dsh-asr-plugin dist-tags --json --registry=https://registry.npmjs.org/
```

Updating a package preserves the existing meeting/model data. Use one active
plugin host per data directory. A package change can require macOS permission
approval; follow the [recording guidance](../README.md#recording-and-meeting-access).

## GitHub package downloads

[GitHub Releases](https://github.com/huliux/dsh-asr-plugin/releases) provide
the same qualified `.tgz` uploaded to npm, with `SHA256SUMS` and release notes.
Choose an attached package archive. GitHub's automatic source ZIP/tar downloads
require the [complete build](development.md); they omit compiled recording assets.

Download the [0.1.6 package](https://github.com/huliux/dsh-asr-plugin/releases/download/v0.1.6/huliux-dsh-asr-plugin-0.1.6.tgz)
and [SHA256SUMS](https://github.com/huliux/dsh-asr-plugin/releases/download/v0.1.6/SHA256SUMS)
into one directory, verify them, and install the absolute
local archive path into your selected profile:

```sh
shasum -a 256 -c SHA256SUMS
dsh plugin --profile web add --ignore-scripts /absolute/path/to/qualified-package.tgz
```

Checksum verification detects changed bytes. Download both files from the
maintainer's release page. The archive excludes models and user data.

## Installing from a fork

A fork that carries local work publishes its own installable artifacts. Pushing
a `v*` tag to the fork runs `.github/workflows/fork-release.yml`, which builds
the plugin, writes the prebuilt tree to that fork's `release/desktop` branch,
attaches a versioned archive with `SHA256SUMS` to the GitHub release, and needs
no local build or approval. The tag must become a package version: `v0.2.0` and
`v0.2.0-fork.3` are used as they are, and a dotted suffix such as
`v0.2.0.fork-erwindassen` becomes `0.2.0-fork-erwindassen`; anything else fails
the job before it publishes:

```sh
dsh plugin --profile desktop add github:erwindassen/dsh-asr-plugin#release/desktop
```

Use the release archive instead when you need an immutable version, verified
against its `SHA256SUMS` the same way as the npm download above. Installing a
source tag directly (`github:owner/repo#v0.2.0`) does not work: this package
generates `dist/`, and pnpm refuses to run the build script of a Git dependency
unless that exact URL is allowlisted (`ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED`),
so the artifacts branch is the installable form of a source tree.

Assembly stays reproducible — `scripts/assemble-release-artifacts.mjs` derives
the tree from the package's `files` allowlist and stamps the version, so the
artifacts branch and the npm tarball cannot drift. Do not edit `release/desktop`
by hand; tag the fork and let the workflow replace it. A published build keeps
the tag's plugin version, so a meeting store migrates once, when the version
that needs it first starts.

A release builds with `pnpm run build:closed-pilot`, never `pnpm run build`.
The plain build produces only the compiled JavaScript; the native addons
(`dist/native/darwin-arm64/*.node`) and the signing helper bundle
(`dist/recording-helper/DSHASRRecordingHelper.app` and its `manifest.json`) come
from the closed-pilot steps. A tree without them installs and then reports
"Local inference components: needs repair", and macOS never lists
`DSHASRRecordingHelper` for Screen Recording and Microphone permissions because
the bundle is absent. The assembly script refuses such a tree, so the failure
now stops the job instead of reaching a user. Rebuilding the helper ad-hoc
changes its CDHash, so a release that rebuilds it can ask for the permissions
once more.

## Source, support and discovery

- [Project site](https://huliux.github.io/dsh-asr-plugin/) provides installation,
  recording examples and FAQs in English and Chinese. Source remains in this
  repository; [site maintenance](https://github.com/huliux/dsh-asr-plugin/blob/main/site/README.md)
  describes its separate build.
- [Source and contributions](https://github.com/huliux/dsh-asr-plugin) include the
  license, native provenance, build requirements and current development state.
- [Issues](https://github.com/huliux/dsh-asr-plugin/issues) are the support route.
  Include versions and content-free diagnostics; keep audio, transcripts, local
  databases and credentials private.
- [Support and contact](../SUPPORT.md) distinguishes public support from private
  inquiries; [the security policy](../SECURITY.md) provides private reporting routes.
- The [`dsh-plugin` topic](https://github.com/topics/dsh-plugin) helps discovery.
  Community catalogs review submissions independently. A topic or listing does
  not establish DeepSeek endorsement or additional platform compatibility.
- [Workflow screenshots](../assets/screenshots/README.md) use fictional meeting
  audio. The root `screenshots.json` declares the images and their display order
  for compatible community catalogs and plugin markets.

- [Official community showcase](https://github.com/deepseek-ai/deepseek-harness/discussions/9125) introduces this unofficial plugin with
  the verified import and meeting-reference example.

## Maintainer delivery

Follow [publishing](publishing.md) for exact-artifact qualification and approval.
The release pack command produces an archive, checksums and a content inventory
without changing the development manifest or publishing anything. Reuse those
exact archive bytes for npm and GitHub; verify both downloads after upload.

Catalog submissions must use the public repository URL, the actual supported
platform and the tested DSH version. Confirm that npm's `latest.repository`
identifies this repository before relying on automated npm mapping. Submit the
catalog's maintained data file and let its maintainers review it.
