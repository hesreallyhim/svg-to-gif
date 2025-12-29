## Releasing and Publishing

### Prerequisites

- Node.js LTS and npm installed
- `ffmpeg` available on your PATH
- Logged in to npm: `npm login`
- (Optional) Husky enabled: `npm run prepare`

### Pre-publish checklist

Before publishing a new version:

```bash
npm run clean
npm ci
npm run lint
npm test
npm run test:coverage
```

### Running integration tests in a CI-like environment

If you want to reproduce CI locally (headless Chromium, fresh install, no access to your host profile):

Using Docker directly:

```bash
docker build -f ci.Dockerfile -t svg-to-gif-ci .
docker run --rm -it -v "$(pwd)":/workspace svg-to-gif-ci bash
# inside the container:
cd /workspace
npm ci
npm run test:integration
```

Using VS Code devcontainer:

1. Open the folder in VS Code.
2. Run “Dev Containers: Reopen in Container”.
3. The devcontainer uses `ci.Dockerfile`, runs `npm ci`, and sets Puppeteer to the system Chromium so `npm run test:integration` matches CI.
