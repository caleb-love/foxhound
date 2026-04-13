# Publishing @foxhound-ai/sdk to NPM

## Pre-publish Checklist

- [x] Version bumped to 0.2.0
- [x] CHANGELOG.md created with all new features
- [x] README.md updated with comprehensive documentation
- [x] Build passes (`pnpm build`)
- [x] Tests pass (`pnpm test`)
- [x] Package contents verified (no test files, clean dist/)
- [x] TypeScript definitions included
- [x] Exports configured correctly

## Package Contents

**Size:** 25.4 kB (gzipped)  
**Unpacked:** 117.2 kB  
**Files:** 23

**Includes:**

- ✅ README.md (world-class documentation)
- ✅ CHANGELOG.md
- ✅ dist/ (compiled TypeScript + type definitions + source maps)
- ✅ package.json

**Excludes:**

- ✅ Test files (\*.test.js)
- ✅ .turbo cache
- ✅ coverage/
- ✅ src/ (source TypeScript files)

## Publishing Steps

### 1. Verify You're Logged In

```bash
npm whoami
```

If not logged in:

```bash
npm login
```

### 2. Final Verification

```bash
cd packages/sdk
pnpm build
pnpm test
npm pack --dry-run
```

### 3. Publish to NPM

```bash
cd packages/sdk
npm publish
```

### 4. Verify Publication

```bash
npm view @foxhound-ai/sdk
npm view @foxhound-ai/sdk version
```

Expected output: `0.2.0`

### 5. Test Installation

```bash
# In a temporary directory
mkdir /tmp/test-foxhound-sdk
cd /tmp/test-foxhound-sdk
npm init -y
npm install @foxhound-ai/sdk
```

### 6. Update Docs Site

After publishing, update the docs site to reference the new version:

```bash
# Update docs-site/docs/sdk/*.md with new features
# Update installation commands to show 0.2.0
```

### 7. Create GitHub Release

```bash
git tag sdk-v0.2.0
git push origin sdk-v0.2.0
```

Then create a GitHub release at https://github.com/caleb-love/foxhound/releases/new

**Tag:** `sdk-v0.2.0`  
**Title:** `@foxhound-ai/sdk v0.2.0`  
**Body:** Copy from CHANGELOG.md

### 8. Announce

- [ ] Tweet from @foxhound_ai
- [ ] Post in Discord (when ready)
- [ ] Update homepage feature list if needed

## Rollback

If something goes wrong:

```bash
npm unpublish @foxhound-ai/sdk@0.2.0
```

**Note:** You can only unpublish within 72 hours of publication.

## Next Steps

After successful publication:

1. Monitor npm download stats
2. Watch for GitHub issues related to the new features
3. Update Python SDK (`packages/sdk-py/`) to match feature parity
4. Consider blog post highlighting the new features (budgets, SLAs, prompts)
