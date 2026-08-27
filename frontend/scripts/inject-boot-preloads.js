// Injects preload hints for the boot chunk group into the SPA fallback page.
//
// The fallback (200.html) is route-agnostic: SvelteKit only emits preload
// links for the entry scripts' own import closure, so the layout/error nodes
// every route mounts — and everything they import, including the shared
// stylesheet — are discovered by waterfall: document -> entry -> router ->
// node -> chunks -> css. This script reads the generated client app manifest
// (the __vite__mapDeps table in the app entry) and adds one preload line per
// asset of the always-loaded nodes, so the browser fetches the whole boot
// group in parallel with parsing. Route-specific nodes are left out — they
// differ per URL and preloading them would compete with first paint.
//
// Runs after `vite build` (see the build script) and regenerates the
// fallback's precompressed siblings, which the adapter produced before this
// script edited the file.
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import zlib from 'zlib'

// Layout and error nodes the SvelteKit client resolves every route through:
// 0 = root layout, 1 = error page, 2 = the (root) group layout all
// user-reachable pages mount.
const ALWAYS_LOADED_NODES = ['0', '1', '2']

const buildDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'build')
const fallback = join(buildDir, '200.html')
if (!existsSync(fallback)) {
	console.log('inject-boot-preloads: no 200.html fallback, skipping')
	process.exit(0)
}
let html = readFileSync(fallback, 'utf8')

const appJs = (html.match(/import\("(\/_app\/immutable\/entry\/app\.[^"]+\.js)"\)/) || [])[1]
if (!appJs) {
	console.error('inject-boot-preloads: could not find app entry in fallback')
	process.exit(1)
}
const appSrc = readFileSync(join(buildDir, appJs.slice(1)), 'utf8')

// the deps table: __vite__mapDeps(...d=(m.f||(m.f=["chunks/x.js","assets/y.css",...]))
const table = appSrc.match(/__vite__mapDeps[\s\S]{0,200}?\[([^\]]+)\]/)
if (!table) {
	console.error('inject-boot-preloads: could not find __vite__mapDeps table')
	process.exit(1)
}
const files = [...table[1].matchAll(/"([^"]+)"/g)].map((m) => m[1])

const assets = new Set()
for (const n of ALWAYS_LOADED_NODES) {
	const m = appSrc.match(
		new RegExp(
			'import\\(`\\.\\./(nodes/' + n + '\\.[^`]+\\.js)`\\),__vite__mapDeps\\(\\[([^\\]]*)\\]'
		)
	)
	if (!m) continue
	// mapDeps paths are relative to the entry/ directory
	assets.add(new URL(m[1], 'http://x/_app/immutable/').pathname)
	for (const idx of m[2].split(',').filter(Boolean)) {
		assets.add(new URL(files[Number(idx)], 'http://x/_app/immutable/entry/').pathname)
	}
}

const lines = []
for (const href of assets) {
	if (html.includes(`"${href}"`)) continue // already referenced by the fallback
	if (href.endsWith('.css')) lines.push(`\t\t<link rel="preload" as="style" href="${href}" />`)
	else lines.push(`\t\t<link rel="modulepreload" href="${href}" />`)
}
html = html.replace('</head>', lines.join('\n') + '\n\t</head>')
writeFileSync(fallback, html)
writeFileSync(fallback + '.gz', zlib.gzipSync(html, { level: 9 }))
writeFileSync(
	fallback + '.br',
	zlib.brotliCompressSync(html, {
		params: {
			[zlib.constants.BROTLI_PARAM_QUALITY]: 11,
			[zlib.constants.BROTLI_PARAM_SIZE_HINT]: Buffer.byteLength(html),
			[zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT
		}
	})
)
console.log(`inject-boot-preloads: ${lines.length} preload hints injected`)
