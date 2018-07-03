import chalk from 'chalk';
import { Schema } from 'swagger-schema-official';
import { InterfaceDeclaration, PropertySignature, SourceFile } from 'ts-simple-ast';

const { green } = chalk;

export function getInterfaceNameFromPath(path: string): string {
	return path
		.split(':')
		.filter((part) => part && part !== 'paths' && part !== 'responses' && part !== 'schema')
		.map((part) => {
			if (part.charAt(0) === '/') {
				part =
					part
						.slice(1)
						.charAt(0)
						.toUpperCase() + part.slice(2);
			} else {
				part = part.charAt(0).toUpperCase() + part.slice(1);
			}
			return part.replace(/-([a-z])/g, (s) => s.charAt(1).toUpperCase());
		})
		.join('');
}

function getInterfaceNameFromString(str: string): string {
	return (str.charAt(0).toUpperCase() + str.substr(1)).replace(/\s+(\S)/g, (s) => s[1].toUpperCase());
}

function getIncrementedName(str: string, names: Set<string>): string {
	let counter = 0;
	while (names.has(`${str}${counter}`)) {
		counter++;
	}
	return `${str}${counter}`;
}

interface AddPropertyOptions {
	sourceFile: SourceFile;
	interfaceName: string;
	interfaceNames: Set<string>;
	interfaceDeclaration: InterfaceDeclaration;
	propertyName: string;
	property: Schema;
	optional: boolean;
}

function getJsDoc(schema: Schema): string | undefined {
	const { description, externalDocs, title } = schema;
	if (description || externalDocs || title) {
		return [
			description,
			title && `Title: ${title}`,
			externalDocs && externalDocs.url && `External docs: ${externalDocs.url}`
		]
			.filter((i) => i)
			.join('\n');
	}
	return undefined;
}

function addProperty({
	sourceFile,
	interfaceName,
	interfaceNames,
	interfaceDeclaration,
	propertyName,
	property,
	optional
}: AddPropertyOptions): PropertySignature {
	function getType(schema: Schema): string {
		const { type: schemaType, enum: propEnum } = schema;
		let type: string;
		switch (schemaType) {
			case 'array':
				type = `${addArrayTypes(schema)}[]`;
				break;
			case 'boolean':
				type = 'boolean';
				break;
			case 'integer':
			case 'number':
				type = 'number';
				break;
			case 'object':
				type = addObjectType(schema, interfaceName);
				break;
			case 'string':
				type = propEnum
					? `'${propEnum
							.filter((item) => typeof item === 'string')
							.map((item) => (item as any).replace(`'`, `\'`))
							.join(`' | '`)}'`
					: 'string';
				break;
			default:
				type = 'any';
		}
		return type;
	}

	function addObjectType(schema: Schema, outerInterfaceName: string): string {
		let interfaceName: string;
		if (schema.title) {
			interfaceName = getInterfaceNameFromString(schema.title);
			if (interfaceNames.has(interfaceName)) {
				interfaceName = getIncrementedName(interfaceName, interfaceNames);
			}
		} else {
			interfaceName = `${outerInterfaceName}${getInterfaceNameFromString(propertyName)}`;
			if (interfaceNames.has(interfaceName)) {
				interfaceName = getIncrementedName(interfaceName, interfaceNames);
			}
		}
		addInterfaceDeclaration({
			interfaceName,
			interfaceNames,
			schema,
			sourceFile
		});
		return interfaceName;
	}

	function addArrayTypes(schema: Schema): string {
		const { items } = schema;
		if (!items) {
			return 'any';
		}
		if (Array.isArray(items)) {
			return `(${items.map((item) => getType(item)).join(' | ')})`;
		} else {
			return getType(items);
		}
	}

	const interfaceProperty = interfaceDeclaration.addProperty({
		name: propertyName,
		type: getType(property),
		hasQuestionToken: optional
	});
	const jsdoc = getJsDoc(property);
	if (jsdoc) {
		interfaceProperty.addJsDoc(jsdoc);
	}

	return interfaceProperty;
}

interface AddInterfaceDeclarationOptions {
	interfaceName: string;
	interfaceNames: Set<string>;
	schema: Schema;
	sourceFile: SourceFile;
}

export function addInterfaceDeclaration({
	interfaceName,
	interfaceNames,
	schema,
	sourceFile
}: AddInterfaceDeclarationOptions): InterfaceDeclaration {
	console.log(green(`    + add interface "${interfaceName}"`));

	const { additionalProperties, properties, required = [] } = schema;
	interfaceNames.add(interfaceName);
	const interfaceDeclaration = sourceFile.addInterface({ name: interfaceName, isExported: true });
	const jsdoc = getJsDoc(schema);
	if (jsdoc) {
		interfaceDeclaration.addJsDoc(jsdoc);
	}
	if (additionalProperties) {
		interfaceDeclaration
			.addIndexSignature({
				keyName: 'prop',
				keyType: 'string',
				returnType: 'any'
			})
			.addJsDoc({
				description: 'schema.additionalProperties: true'
			});
	}
	if (properties) {
		for (const propertyName in properties) {
			addProperty({
				sourceFile,
				interfaceName,
				interfaceNames,
				interfaceDeclaration,
				propertyName,
				property: properties[propertyName],
				optional: !required.includes(propertyName)
			});
		}
	}
	return interfaceDeclaration;
}
