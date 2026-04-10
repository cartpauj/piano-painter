# Releasing PianoPainter

Releases are automated via GitHub Actions. Pushing a version tag triggers a build across all supported platforms and publishes a GitHub Release with the installers attached.

## Supported Platforms

- macOS Apple Silicon (arm64)
- macOS Intel (x86_64)
- Linux x64
- Linux ARM64
- Windows x64

## Release Steps

1. **Bump the version** in these three files (keep them in sync):
   - `package.json` — `"version"`
   - `src-tauri/Cargo.toml` — `version = "..."` under `[package]`
   - `src-tauri/tauri.conf.json` — `"version"`

2. **Commit the version bump**:
   ```bash
   git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json
   git commit -m "Bump version to v0.0.2"
   git push
   ```

3. **Create and push a tag** (tag must start with `v`):
   ```bash
   git tag v0.0.2
   git push origin v0.0.2
   ```

4. **Watch the build** at `https://github.com/cartpauj/piano-painter/actions`. It takes 15-30 minutes across all platforms.

5. **Check the release** at `https://github.com/cartpauj/piano-painter/releases`. If all 5 builds succeed, the release is automatically published. If any fail, it stays as a draft — fix the issue and either delete the tag and retry, or manually publish once you re-run the failed job.

## Retrying a Failed Release

If a build fails:
```bash
# Delete the tag locally and remotely
git tag -d v0.0.2
git push origin :refs/tags/v0.0.2

# Delete the draft release on GitHub (manually via UI or gh CLI)
gh release delete v0.0.2 --yes

# Fix the issue, commit, then re-tag and push
git tag v0.0.2
git push origin v0.0.2
```

## Versioning

Using semver: `MAJOR.MINOR.PATCH`
- **Patch** (0.0.x) — bug fixes
- **Minor** (0.x.0) — new features, backwards-compatible
- **Major** (x.0.0) — breaking changes

## Workflow File

The workflow lives at `.github/workflows/release.yml`. Triggered by any tag matching `v*`.
