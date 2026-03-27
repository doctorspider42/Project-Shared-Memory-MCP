#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PROJECT_ROOT = process.env.PROJECT_ROOT || '/project';
const MEMORIES_DIR = path.join(PROJECT_ROOT, '.github', 'memories');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureMemoriesDir(): void {
	fs.mkdirSync(MEMORIES_DIR, { recursive: true });
}

function validatePath(memoryPath: string): string | undefined {
	if (!memoryPath.startsWith('/memories/') && memoryPath !== '/memories') {
		return 'Error: All memory paths must start with /memories/';
	}
	if (memoryPath.includes('..')) {
		return 'Error: Path traversal is not allowed';
	}
	const segments = memoryPath.split('/').filter(s => s.length > 0);
	if (segments.some(s => s === '.')) {
		return 'Error: Path traversal is not allowed';
	}
	if (segments[0] !== 'memories') {
		return 'Error: All memory paths must start with /memories/';
	}
	return undefined;
}

/** Maps a virtual /memories/... path to a real filesystem path under .github/memories */
function resolveMemoryPath(memoryPath: string): string {
	const segments = memoryPath.split('/').filter(s => s.length > 0);
	// segments[0] === 'memories', rest are relative
	const relative = segments.slice(1);
	return path.join(MEMORIES_DIR, ...relative);
}

function normalizePath(p: string): string {
	return p.endsWith('/') ? p : p + '/';
}

function isMemoriesRoot(p: string): boolean {
	return normalizePath(p) === '/memories/';
}

function formatLineNumber(line: number): string {
	return String(line).padStart(6, ' ');
}

function formatFileContent(memoryPath: string, content: string): string {
	const lines = content.split('\n');
	const numbered = lines.map((line, i) => `${formatLineNumber(i + 1)}\t${line}`);
	return `Here's the content of ${memoryPath} with line numbers:\n${numbered.join('\n')}`;
}

function makeSnippet(fileContent: string, editLine: number, memoryPath: string): string {
	const lines = fileContent.split('\n');
	const snippetRadius = 4;
	const start = Math.max(0, editLine - 1 - snippetRadius);
	const end = Math.min(lines.length, editLine - 1 + snippetRadius + 1);
	const snippet = lines.slice(start, end);
	const numbered = snippet.map((line, i) => `${formatLineNumber(start + i + 1)}\t${line}`);
	return `The memory file has been edited. Here's the result of running \`cat -n\` on a snippet of ${memoryPath}:\n${numbered.join('\n')}`;
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

function doView(memoryPath: string, viewRange?: [number, number]): string {
	const error = validatePath(memoryPath);
	if (error) {
		return error;
	}

	const resolved = resolveMemoryPath(memoryPath);

	if (isMemoriesRoot(memoryPath)) {
		ensureMemoriesDir();
		return listDirectory(memoryPath, resolved);
	}

	if (!fs.existsSync(resolved)) {
		return `No memories found in ${memoryPath}.`;
	}

	const stat = fs.statSync(resolved);
	if (stat.isDirectory()) {
		return listDirectory(memoryPath, resolved);
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

function listDirectory(memoryPath: string, resolved: string, maxDepth: number = 2, currentDepth: number = 0): string {
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
			const subLines = listDirectory(childPath, childResolved, maxDepth, currentDepth + 1);
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

function doCreate(memoryPath: string, fileText: string): string {
	const error = validatePath(memoryPath);
	if (error) {
		return error;
	}

	const resolved = resolveMemoryPath(memoryPath);

	if (fs.existsSync(resolved)) {
		return `Error: File ${memoryPath} already exists`;
	}

	const parentDir = path.dirname(resolved);
	fs.mkdirSync(parentDir, { recursive: true });
	fs.writeFileSync(resolved, fileText, 'utf-8');

	return `File created successfully at: ${memoryPath}`;
}

function doStrReplace(memoryPath: string, oldStr: string, newStr: string): string {
	const error = validatePath(memoryPath);
	if (error) {
		return error;
	}

	const resolved = resolveMemoryPath(memoryPath);

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

function doInsert(memoryPath: string, insertLine: number, insertText: string): string {
	const error = validatePath(memoryPath);
	if (error) {
		return error;
	}

	const resolved = resolveMemoryPath(memoryPath);

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

function doDelete(memoryPath: string): string {
	const error = validatePath(memoryPath);
	if (error) {
		return error;
	}

	const resolved = resolveMemoryPath(memoryPath);

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

function doRename(oldPath: string, newPath: string): string {
	const oldError = validatePath(oldPath);
	if (oldError) {
		return oldError;
	}
	const newError = validatePath(newPath);
	if (newError) {
		return newError;
	}

	const resolvedOld = resolveMemoryPath(oldPath);
	const resolvedNew = resolveMemoryPath(newPath);

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

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

const server = new McpServer({
	name: 'project-memory',
	version: '1.0.0',
});

server.tool(
	'memory_view',
	'View contents of a memory file or list directory contents. Use path "/memories/" to see all memories.',
	{
		path: z.string().describe('The memory path, e.g. "/memories/" or "/memories/notes.md"'),
		view_range: z.tuple([z.number(), z.number()]).optional().describe('Optional [start_line, end_line] (1-indexed) to view a specific range of lines'),
	},
	async ({ path: memoryPath, view_range }) => {
		const result = doView(memoryPath, view_range as [number, number] | undefined);
		return { content: [{ type: 'text' as const, text: result }] };
	},
);

server.tool(
	'memory_create',
	'Create a new memory file. Fails if the file already exists.',
	{
		path: z.string().describe('The memory path, e.g. "/memories/notes.md"'),
		file_text: z.string().describe('The content to write to the file'),
	},
	async ({ path: memoryPath, file_text }) => {
		const result = doCreate(memoryPath, file_text);
		return { content: [{ type: 'text' as const, text: result }] };
	},
);

server.tool(
	'memory_str_replace',
	'Replace an exact string in a memory file with a new string. The old_str must appear exactly once.',
	{
		path: z.string().describe('The memory path to the file to edit'),
		old_str: z.string().describe('The exact string to find and replace (must appear exactly once)'),
		new_str: z.string().describe('The replacement string'),
	},
	async ({ path: memoryPath, old_str, new_str }) => {
		const result = doStrReplace(memoryPath, old_str, new_str);
		return { content: [{ type: 'text' as const, text: result }] };
	},
);

server.tool(
	'memory_insert',
	'Insert text at a specific line number in a memory file. Line 0 inserts at the beginning.',
	{
		path: z.string().describe('The memory path to the file to edit'),
		insert_line: z.number().describe('The 0-based line number to insert text at'),
		insert_text: z.string().describe('The text to insert at the specified line'),
	},
	async ({ path: memoryPath, insert_line, insert_text }) => {
		const result = doInsert(memoryPath, insert_line, insert_text);
		return { content: [{ type: 'text' as const, text: result }] };
	},
);

server.tool(
	'memory_delete',
	'Delete a memory file or directory (and all its contents).',
	{
		path: z.string().describe('The memory path to delete'),
	},
	async ({ path: memoryPath }) => {
		const result = doDelete(memoryPath);
		return { content: [{ type: 'text' as const, text: result }] };
	},
);

server.tool(
	'memory_rename',
	'Rename or move a memory file or directory.',
	{
		old_path: z.string().describe('The current memory path'),
		new_path: z.string().describe('The new memory path'),
	},
	async ({ old_path, new_path }) => {
		const result = doRename(old_path, new_path);
		return { content: [{ type: 'text' as const, text: result }] };
	},
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
	ensureMemoriesDir();
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error('project-memory MCP server running on stdio');
}

main().catch((err) => {
	console.error('Fatal error:', err);
	process.exit(1);
});
