# iOS Release → TestFlight CI

Workflow file: `.github/workflows/ios-release.yml`

Manual-dispatch only (`workflow_dispatch`). Input:

- `env`: `staging` or `production`. Selects the GitHub Environment (and therefore its secrets), the env file `.env.<env>`, the Xcode scheme/configuration (`Staging`/`ReleaseStag` or `Production`/`ReleaseProd`) and the Fastlane lane `fastlane ios <env>` (see `fastlane/Fastfile`). The build is uploaded to TestFlight.

Give the `production` GitHub Environment required reviewers so a production build always needs approval.

## Required GitHub secrets (per environment: `staging`, `production`)

Set these as **environment secrets** — never commit values, never echo them in a step:

| Secret                                  | Used for                                                                        |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| `APP_ENV_FILE`                          | Full content of `.env.staging` / `.env.production` (shared with the Android workflow) |
| `IOS_APP_STORE_CONNECT_KEY_ID`          | App Store Connect API key id                                                    |
| `IOS_APP_STORE_CONNECT_ISSUER_ID`       | App Store Connect API key issuer id                                             |
| `IOS_APP_STORE_CONNECT_API_KEY`         | Base64-encoded `.p8` App Store Connect API key content                          |
| `IOS_DEVELOPMENT_TEAM`                  | Apple Developer Team ID used for code signing                                   |
| `IOS_DISTRIBUTION_CERTIFICATE_BASE64`   | Base64-encoded Apple Distribution `.p12` containing its private key             |
| `IOS_DISTRIBUTION_CERTIFICATE_PASSWORD` | Password used when the Apple Distribution `.p12` was exported                   |
| `IOS_PROVISIONING_PROFILE_BASE64`       | Base64-encoded App Store `.mobileprovision` **for that environment's bundle id** |
| `IOS_APPLE_ID`                          | Optional. Apple ID, only needed if fastlane falls back to it                    |
| `IOS_APP_STORE_CONNECT_TEAM_ID`         | Optional. App Store Connect team id, only needed for accounts on multiple teams |

The API key, team, certificate and password are usually identical in both environments; the provisioning profile differs because each environment has its own bundle id.

`APP_ENV_FILE` must contain at least `IOS_BUNDLE_ID`, `IOS_APP_VERSION_NAME` and `APP_NAME`. Everything in it is bundled into the app by `react-native-config`, so it must never contain credentials. Update it whenever the local env file changes:

```sh
yarn env:push:staging
yarn env:push:production
```

Create the Base64 values on macOS without printing them to the terminal, for example:

```sh
base64 -i "LingoBites-Apple-Distribution.p12" | gh secret set IOS_DISTRIBUTION_CERTIFICATE_BASE64 --env staging
base64 -i "LingoBites-Staging-AppStore.mobileprovision" | gh secret set IOS_PROVISIONING_PROFILE_BASE64 --env staging
base64 -i "LingoBites-Production-AppStore.mobileprovision" | gh secret set IOS_PROVISIONING_PROFILE_BASE64 --env production
```

The workflow writes `.env.<env>` from `APP_ENV_FILE`, decodes the certificate and profile under `$RUNNER_TEMP`, imports the certificate into Fastlane's temporary keychain, installs the provisioning profile, and removes all of them during cleanup.

## Safety checks

- Before archiving, the workflow asserts that the bundle id Xcode resolves for the selected scheme equals `IOS_BUNDLE_ID` from `APP_ENV_FILE`.
- For `staging`, it additionally aborts if the resolved bundle id looks like a production identifier (`*prod*` / `*Production*`).

## How to run it

Via the Actions tab: open **Actions → iOS Release TestFlight → Run workflow** and pick `env`.

Via the CLI:

```sh
gh workflow run ios-release.yml -f env=staging
```

## Build number

Automatic. Before archiving, fastlane reads the latest build number uploaded to
TestFlight for the app (any version) via the App Store Connect API and uses it + 1.
It is passed to Xcode as `CURRENT_PROJECT_VERSION`, so no project file is modified.
Set `IOS_APP_BUILD_NUMBER` to force a specific value. `IOS_APP_VERSION_NAME` still
comes from `APP_ENV_FILE`; bump it yourself for a new release version.

Before a store submission: bump `IOS_APP_VERSION_NAME` in `.env.production`, push
it with `yarn env:push:production`, then run this workflow with `force_build` (the
fingerprint does not change when only the env file does). The app shows and reports
this value (Profile → Giới thiệu, analytics, `X-App-Version`); `package.json`'s
`version` is not used.

## How to verify a run succeeded

- The job's "Build and upload to TestFlight" step logs the fastlane summary,
  including the build number and the IPA name `LingoBites-<Scheme>.ipa`.
- App Store Connect → TestFlight → the app shows the new build once Apple
  finishes processing it (the job does not wait for processing —
  `skip_waiting_for_build_processing: true`).

## Recovery if a run fails partway

Re-dispatching or re-running the workflow is safe: the build number is looked up
from TestFlight on every run, so a retry never collides with a previous upload.
No manual cleanup is required
between attempts — the job's cleanup step runs `if: always()` and removes the
materialized env file, Xcode config, certificate, provisioning profile, and
temporary keychain regardless of how the job ended.
