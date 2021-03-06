import * as yargs from 'yargs';
import chalk from 'chalk';
import * as SwaggerParser from 'swagger-parser';
import { Info, Path, Schema } from 'swagger-schema-official';
import Project from 'ts-simple-ast';
import { getInterfaceNameFromPath, addInterfaceDeclaration } from './declarationWriter';
import { readable } from './util';
import walk from './walk';

const { bold, red } = chalk;

const packageJson: { version: string } = require('../package.json');

console.log();
console.log(bold('oas2dts – A Open API (Swagger) to TypeScript definition converter'));
console.log();

const argv = yargs
	.pkgConf('oas2dts')
	.example('$0 api.yaml', 'Outputs the type definition for "api.yaml".')
	.usage('usage: $0 [input]')
	.demandCommand(1)
	.version('version', 'Show version information', `Version ${packageJson.version}\n`)
	.alias('version', 'v')
	.help()
	.wrap(80).argv;

(async function main() {
	const inputArg = argv._[0];
	try {
		readable(inputArg);
	} catch (e) {
		console.error();
		console.error(red(`Input file "${bold(inputArg)}" missing or not readable.`));
		console.error(e);
		console.error();
	}
	console.log(`  Loading: "${inputArg}"`);
	const prolog: (string | undefined)[] = [
		`Auto generated by oas2dts (Version ${packageJson.version})`,
		`Date: ${Date().toString()}`,
		`Input: ${inputArg}`,
		` `
	];
	const api = await SwaggerParser.validate(inputArg);
	const pathStack: string[] = [];
	const schemas = new Map<string, Schema>();
	const paths = new Map<string, Path>();
	let pathsNode: { [pathName: string]: Path } | undefined;
	let info: Info | undefined;
	walk(api, {
		enter(node, parent, prop, index) {
			// detect entry to a paths node
			if (prop === 'paths') {
				pathsNode = node;
			}

			// if in a direct descendent of a paths node, go ahead and store the node
			if (pathsNode && parent === pathsNode && prop) {
				paths.set(prop, node);
			}

			// set pathing
			if (typeof index === 'number') {
				pathStack.push(String(index));
			} else {
				pathStack.push(prop || '');
			}

			// if a schema node, go head and store it in the schema map
			if (prop === 'schema') {
				schemas.set(pathStack.join(':'), node);
				this.skip();
				pathStack.pop();
			}

			// if root info node, cache it
			if (!info && prop === 'info' && parent === api) {
				info = node;
			}
		},
		leave(node) {
			if (pathsNode === node) {
				pathsNode === undefined;
			}
			pathStack.pop();
		}
	});

	let outfile = 'output/schemas.d.ts';
	if (info) {
		prolog.push(
			`Title: ${info.title}`,
			`Version: ${info.version}`,
			info.description && `Description: ${info.description}`,
			info.license && `License: ${info.license.name + info.license.url ? `(${info.license.url})` : ''}`,
			info.termsOfService && `Terms of service: ${info.termsOfService}`,
			info.contact &&
				`Contact: ${info.contact.name || ''} ${info.contact.email && `<${info.contact.email}>`} ${info.contact
					.url && `(${info.contact.url})`}`
		);
		outfile = `output/${info.title.replace(' ', '').toLowerCase()}/${info.version}/schemas.d.ts`;
	}

	const project = new Project();

	const sourceFile = project.createSourceFile(outfile);
	console.log(bold(`  + add declaration file: ${outfile}`));
	const interfaceNames = new Set<string>();
	for (const [path, schema] of schemas) {
		if (schema.type === 'object') {
			const interfaceName = getInterfaceNameFromPath(path);
			addInterfaceDeclaration({
				interfaceName,
				interfaceNames,
				schema,
				sourceFile
			});
		}
	}

	// insert prolog into source file
	sourceFile.insertText(0, `/*\n * ${prolog.filter((p) => p).join('\n * ')}\n */\n\n`);
	console.log(`    * detected ${interfaceNames.size} interfaces`);
	console.log(`  save declaration file: ${outfile}`);
	await project.save();
	console.log(bold('\ndone.\n'));
})();

export = {};
