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
```
