import { Spec } from 'swagger-schema-official';

export interface Context {
	skip(): void;
}

export interface EnterFunction {
	(this: Context, node: any, parent: any, prop: string | undefined, index: number | undefined): void;
}

export interface LeaveFunction {
	(node: any, parent: any, prop: string | undefined, index: number | undefined): void;
}

export interface ParseOptions {
	enter?: EnterFunction;
	leave?: LeaveFunction;
}

let shouldSkip = false;
const context: Context = {
	skip() {
		shouldSkip = true;
	}
};

function visit(node: any, parent: any, enter?: EnterFunction, leave?: LeaveFunction, prop?: string, index?: number) {
	if (!node) {
		return;
	}

	if (enter) {
		let _shouldSkip = shouldSkip;
		shouldSkip = false;
		enter.call(context, node, parent, prop, index);
		const skipped = shouldSkip;
		shouldSkip = _shouldSkip;

		if (skipped) {
			return;
		}
	}

	const keys = Object.keys(node).filter((key) => typeof node[key] === 'object');

	for (let i = 0; i < keys.length; i++) {
		const key = keys[i];
		const value = node[key];
		if (Array.isArray(value)) {
			for (let j = 0; j < value.length; j++) {
				const arrValue = value[j];
				if (arrValue && typeof arrValue === 'object') {
					visit(arrValue, value, enter, leave, prop, j);
				}
			}
		} else if (value) {
			visit(value, node, enter, leave, key);
		}
	}

	if (leave) {
		leave(node, parent, prop, index);
	}
}

export default function walk(specification: Spec, { enter, leave }: ParseOptions = {}) {
	visit(specification, null, enter, leave);
}
