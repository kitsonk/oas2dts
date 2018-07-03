import { access, constants, PathLike, readFile } from 'fs';

/**
 * Check to see if a file is readable.  Resolves to `true` if readable, otherwise rejects.
 * @param path The path to check to see if the file is readable
 */
export function readable(path: PathLike) {
	return new Promise<true>((resolve, reject) => {
		access(path, constants.R_OK, (err) => {
			if (err) {
				return reject(err);
			}
			resolve(true);
		});
	});
}

export function read(path: PathLike): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		readFile(path, 'utf8', (err, res) => {
			if (err) {
				reject(err);
			} else {
				resolve(res);
			}
		});
	});
}
