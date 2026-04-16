import * as fs from 'node:fs';
import * as path from 'node:path';
import {
	validatePath,
	resolveMemoryPath,
	isMemoriesRoot,
	getScope,
	formatFileContent,
	makeSnippet,
	formatLineNumber,
} from './utils.js';

export function ensureMemoriesDir(memoriesDir: string): void {
	fs.mkdirSync(memoriesDir, { recursive: true });
}

export function doView(memoriesDir: string, memoryPath: string, viewRange?: [number, number]): string {
	const error = validatePath(memoryPath);
	if (error) {
		return error;
	}

	const resolved = resolveMemoryPath(memoriesDir, memoryPath);

	if (isMemoriesRoot(memoryPath)) {
		ensureMemoriesDir(memoriesDir);
		return listMemoriesRoot(memoriesDir);
	}

	if (!fs.existsSync(resolved)) {
		return `No memories found in ${memoryPath}.`;
	}

	const stat = fs.statSync(resolved);
	if (stat.isDirectory()) {
		return listDirectory(memoriesDir, memoryPath, resolved);
	}

	const content = fs.readFileSync(resolved, 'utf-8');

	if (viewRange) {
		const lines = content.split('\n');
		const [start, end] = viewRange;
		if (start < 1 || start > lines.length) {
			return `Error: Invalid view_range: start line ${start} is out of range [1, ${lines.length}].`;
		}
		if (end < start || end > lines.length) {
			return `Error: Invalid view_range: end line ${end} is out of range [${start}, ${lines.length}].`;
		}
		const sliced = lines.slice(start - 1, end);
		const numbered = sliced.map((line, i) => `${formatLineNumber(start + i)}\t${line}`);
		return `Here's the content of ${memoryPath} (lines ${start}-${end}) with line numbers:\n${numbered.join('\n')}`;
	}

	return formatFileContent(memoryPath, content);
}

export function listDirectory(memoriesDir: string, memoryPath: string, resolved: string, maxDepth: number = 2, currentDepth: number = 0): string {
	if (currentDepth >= maxDepth) {
		return '';
	}

	if (!fs.existsSync(resolved)) {
		return `No memories found in ${memoryPath}.`;
	}

	const entries = fs.readdirSync(resolved, { withFileTypes: true });
	const lines: string[] = [];

	const sorted = entries
		.filter(e => !e.name.startsWith('.'))
		.sort((a, b) => {
			if (a.isDirectory() && !b.isDirectory()) {
				return -1;
			}
			if (!a.isDirectory() && b.isDirectory()) {
				return 1;
			}
			return 0;
		});

	for (const entry of sorted) {
		const childResolved = path.join(resolved, entry.name);
		const childPath = memoryPath.endsWith('/') ? `${memoryPath}${entry.name}` : `${memoryPath}/${entry.name}`;
		const prefix = '  '.repeat(currentDepth);

		if (entry.isDirectory()) {
			lines.push(`${prefix}${entry.name}/`);
			const subLines = listDirectory(memoriesDir, childPath, childResolved, maxDepth, currentDepth + 1);
			if (subLines) {
				lines.push(subLines);
			}
		} else {
			const stat = fs.statSync(childResolved);
			lines.push(`${prefix}${stat.size}\t${childPath}`);
		}
	}

	if (currentDepth === 0) {
		if (lines.length === 0) {
			return 'No memories found.';
		}
		return `Here are the files and directories up to 2 levels deep in ${memoryPath}, excluding hidden items:\n${lines.join('\n')}`;
	}
	return lines.join('\n');
}

export function listMemoriesRoot(memoriesDir: string): string {
	const lines: string[] = [];
	const userDir = path.join(memoriesDir, 'user');
	const repoDir = path.join(memoriesDir, 'repo');
	const sessionDir = path.join(memoriesDir, 'session');

	// Scope directories
	for (const [dir, name] of [[repoDir, 'repo'], [sessionDir, 'session']] as const) {
		if (fs.existsSync(dir)) {
			const entries = fs.readdirSync(dir).filter(e => !e.startsWith('.'));
			if (entries.length > 0) {
				lines.push(`${name}/`);
				const sub = listDirectory(memoriesDir, `/memories/${name}`, dir, 2, 1);
				if (sub) {
					lines.push(sub);
				}
			}
		}
	}

	// User files (displayed as if directly under /memories/)
	if (fs.existsSync(userDir)) {
		const entries = fs.readdirSync(userDir, { withFileTypes: true })
			.filter(e => !e.name.startsWith('.'))
			.sort((a, b) => {
				if (a.isDirectory() && !b.isDirectory()) return -1;
				if (!a.isDirectory() && b.isDirectory()) return 1;
				return a.name.localeCompare(b.name);
			});

		for (const entry of entries) {
			const childResolved = path.join(userDir, entry.name);
			if (entry.isDirectory()) {
				lines.push(`${entry.name}/`);
				const sub = listDirectory(memoriesDir, `/memories/${entry.name}`, childResolved, 2, 1);
				if (sub) {
					lines.push(sub);
				}
			} else {
				const stat = fs.statSync(childResolved);
				lines.push(`${stat.size}\t/memories/${entry.name}`);
			}
		}
	}

	if (lines.length === 0) {
		return 'No memories found.';
	}

	return `Here are the files and directories up to 2 levels deep in /memories/, excluding hidden items:\n${lines.join('\n')}`;
}

export function doCreate(memoriesDir: string, memoryPath: string, fileText: string): string {
	const error = validatePath(memoryPath);
	if (error) {
		return error;
	}

	const resolved = resolveMemoryPath(memoriesDir, memoryPath);

	if (fs.existsSync(resolved)) {
		return `Error: File ${memoryPath} already exists`;
	}

	const parentDir = path.dirname(resolved);
	fs.mkdirSync(parentDir, { recursive: true });
	fs.writeFileSync(resolved, fileText, 'utf-8');

	return `File created successfully at: ${memoryPath}`;
}

export function doStrReplace(memoriesDir: string, memoryPath: string, oldStr: string, newStr: string): string {
	const error = validatePath(memoryPath);
	if (error) {
		return error;
	}

	const resolved = resolveMemoryPath(memoriesDir, memoryPath);

	if (!fs.existsSync(resolved)) {
		return `The path ${memoryPath} does not exist. Please provide a valid path.`;
	}

	const content = fs.readFileSync(resolved, 'utf-8');

	const occurrences: number[] = [];
	let searchStart = 0;
	while (true) {
		const idx = content.indexOf(oldStr, searchStart);
		if (idx === -1) {
			break;
		}
		const lineNumber = content.substring(0, idx).split('\n').length;
		occurrences.push(lineNumber);
		searchStart = idx + 1;
	}

	if (occurrences.length === 0) {
		return `No replacement was performed, old_str \`${oldStr}\` did not appear verbatim in ${memoryPath}.`;
	}

	if (occurrences.length > 1) {
		return `No replacement was performed. Multiple occurrences of old_str \`${oldStr}\` in lines: ${occurrences.join(', ')}. Please ensure it is unique.`;
	}

	const newContent = content.replace(oldStr, newStr);
	fs.writeFileSync(resolved, newContent, 'utf-8');

	return makeSnippet(newContent, occurrences[0], memoryPath);
}

export function doInsert(memoriesDir: string, memoryPath: string, insertLine: number, insertText: string): string {
	const error = validatePath(memoryPath);
	if (error) {
		return error;
	}

	const resolved = resolveMemoryPath(memoriesDir, memoryPath);

	if (!fs.existsSync(resolved)) {
		return `Error: The path ${memoryPath} does not exist`;
	}

	const content = fs.readFileSync(resolved, 'utf-8');
	const lines = content.split('\n');
	const nLines = lines.length;

	if (insertLine < 0 || insertLine > nLines) {
		return `Error: Invalid \`insert_line\` parameter: ${insertLine}. It should be within the range of lines of the file: [0, ${nLines}].`;
	}

	const newLines = insertText.split('\n');
	lines.splice(insertLine, 0, ...newLines);

	const newContent = lines.join('\n');
	fs.writeFileSync(resolved, newContent, 'utf-8');

	return makeSnippet(newContent, insertLine + 1, memoryPath);
}

export function doDelete(memoriesDir: string, memoryPath: string): string {
	const error = validatePath(memoryPath);
	if (error) {
		return error;
	}

	const resolved = resolveMemoryPath(memoriesDir, memoryPath);

	if (!fs.existsSync(resolved)) {
		return `Error: The path ${memoryPath} does not exist`;
	}

	const stat = fs.statSync(resolved);
	if (stat.isDirectory()) {
		fs.rmSync(resolved, { recursive: true });
	} else {
		fs.unlinkSync(resolved);
	}

	return `Successfully deleted ${memoryPath}`;
}

export function doRename(memoriesDir: string, oldPath: string, newPath: string): string {
	const oldError = validatePath(oldPath);
	if (oldError) {
		return oldError;
	}
	const newError = validatePath(newPath);
	if (newError) {
		return newError;
	}

	const resolvedOld = resolveMemoryPath(memoriesDir, oldPath);
	const resolvedNew = resolveMemoryPath(memoriesDir, newPath);

	if (!fs.existsSync(resolvedOld)) {
		return `Error: The path ${oldPath} does not exist`;
	}

	if (fs.existsSync(resolvedNew)) {
		return `Error: The destination ${newPath} already exists`;
	}

	const destParent = path.dirname(resolvedNew);
	fs.mkdirSync(destParent, { recursive: true });
	fs.renameSync(resolvedOld, resolvedNew);

	return `Successfully renamed ${oldPath} to ${newPath}`;
}
