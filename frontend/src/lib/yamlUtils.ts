// Kept out of $lib/utils on purpose: utils is on every page's boot path and
// this is its only runtime dependency on the yaml parser, which is a whole
// chunk of its own. Import from here so only diff/deploy surfaces pay for it.
import YAML from 'yaml'

function sortObjectKeys(obj: any): any {
	if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
		const sortedObj: any = {}
		Object.keys(obj)
			.sort()
			.forEach((key) => {
				sortedObj[key] = sortObjectKeys(obj[key])
			})
		return sortedObj
	} else if (Array.isArray(obj)) {
		return obj.map((item) => sortObjectKeys(item))
	} else {
		return obj
	}
}

export function orderedYamlStringify(obj: any) {
	const sortedObj = sortObjectKeys(obj)
	return YAML.stringify(sortedObj)
}
