# Plugin Directory

A Paperclip plugin that adds a browsable plugin directory to the sidebar.

Users can search, browse, and one-click install community plugins from a curated registry without needing to know npm package names.

## How it works

- Registers a **page** slot at `/plugin-directory` for the browse UI
- Registers a **sidebar** slot for navigation
- Serves the directory registry via the `getData` bridge
- Triggers installs via `performAction` calling `POST /api/plugins/install`

## Adding plugins to the directory

Edit the `BUNDLED_REGISTRY` array in `src/worker.ts` and open a PR. Each entry needs:

```typescript
{
  name: "Plugin Name",
  packageName: "@scope/package-name",  // npm package
  description: "What it does.",
  author: "Author Name",
  category: "notifications",           // example | notifications | monitoring | integrations | utilities
  source: "https://github.com/..."     // optional source link
}
```

## Development

```bash
npm install
npm run build
```

Install locally in Paperclip for testing:

```bash
# From the Paperclip root
pnpm --filter server exec paperclip plugin install ./doc/plugins/plugin-directory
```
