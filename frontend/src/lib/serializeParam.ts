// Kept out of svelte5UtilsKit on purpose: navigation.ts is on every page's
// boot path and only needs this helper, while svelte5UtilsKit drags the zod
// runtime along for its schema-guided URL-state utilities.

/** Serialize a value to a URL search param string. Primitives are written as-is; anything else is JSON. */
export function serializeParam(value: unknown): string {
	if (typeof value === 'string') return value
	if (typeof value === 'number') return String(value)
	if (typeof value === 'boolean') return String(value)
	return JSON.stringify(value)
}
