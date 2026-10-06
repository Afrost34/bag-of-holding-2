/**
 * Architecture boundaries. Breaking one fails `pnpm deps:check` (and CI).
 * Add a rule here whenever a new package gets a layering constraint.
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular imports make modules impossible to reason about in isolation.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'packages-not-to-apps',
      severity: 'error',
      comment: 'Shared packages must never depend on an app.',
      from: { path: '^packages/' },
      to: { path: '^apps/' },
    },
    {
      name: 'storage-is-ui-free',
      severity: 'error',
      comment: 'Storage is plain TypeScript: no React, no UI.',
      from: { path: '^packages/storage/' },
      to: { path: '(^packages/ui/)|(node_modules/(react|react-dom)/)' },
    },
    {
      name: 'tauri-only-via-entry',
      severity: 'error',
      comment:
        'Tauri APIs crash in a browser. Only packages/storage/src/tauri.ts and apps/desktop may import them; the web app loads that file dynamically.',
      from: { pathNot: '^(packages/storage/src/tauri\\.ts|apps/desktop/)' },
      to: { path: 'node_modules/@tauri-apps/' },
    },
    {
      name: 'features-not-to-features',
      severity: 'error',
      comment: 'Feature folders must not import each other; share code through app/ or a package.',
      from: { path: '^apps/web/src/features/([^/]+)/' },
      to: {
        path: '^apps/web/src/features/([^/]+)/',
        pathNot: '^apps/web/src/features/$1/',
      },
    },
    {
      name: 'data5e-is-ui-free',
      severity: 'error',
      comment:
        'The data layer is plain TypeScript (runs in a worker and in Node): no React, no UI.',
      from: { path: '^packages/data5e/' },
      to: { path: '(^packages/(ui|storage)/)|(node_modules/(react|react-dom)/)' },
    },
    {
      name: 'test-fixtures-only-in-tests',
      severity: 'error',
      comment: 'Test fixtures and local-data helpers are for tests and e2e only.',
      from: { pathNot: '(\\.(test|testkit)\\.tsx?$)|(/e2e/)|(/testing/)' },
      to: { path: '/src/testing/' },
    },
    {
      name: 'no-test-code-in-prod',
      severity: 'error',
      from: { pathNot: '\\.(test|testkit)\\.tsx?$' },
      to: { path: '\\.(test|testkit)\\.tsx?$' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    // Anchored to whole folder names: a bare "dist" would also hide packages that ship "dist-js".
    exclude: { path: '(^|/)(dist|coverage|src-tauri)/|routeTree\\.gen\\.ts$' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
    },
  },
};
