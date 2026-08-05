// Lets plain `node` run our TypeScript modules directly for verification
// scripts, without adding a build step or a test framework.
//
// Node 24 strips types natively, but its ESM resolver still won't follow
// TypeScript's extensionless relative imports (`./usage-cost`) or the `@/`
// path alias from tsconfig. This hook fills in both.
//
// Usage: node --import ./scripts/ts-resolve-hook.mjs scripts/whatever.mjs

import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register(new URL('./ts-resolve-impl.mjs', import.meta.url), pathToFileURL('./'))
