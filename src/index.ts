#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as path from 'node:path';
import { z } from 'zod';
import {
	ensureMemoriesDir,
	doView,
	doCreate,
	doStrReplace,
	doInsert,
	doDelete,
	doRename,
} from './operations.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PROJECT_ROOT = process.env.PROJECT_ROOT || '/project';
const MEMORIES_DIR = path.join(PROJECT_ROOT, '.github', 'memories');

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

const server = new McpServer({
	name: 'project-shared-memory',
	version: '1.0.0',
});

server.tool(
	'memory_view',
	'View contents of a memory file or list directory contents. Use path "/memories/" to see all memories.',
	{
		path: z.string().describe('The memory path, e.g. "/memories/" or "/memories/notes.md"'),
		view_range: z.array(z.number()).min(2).max(2).optional().describe('Optional [start_line, end_line] (1-indexed) to view a specific range of lines'),
	},
	async ({ path: memoryPath, view_range }) => {
		const result = doView(MEMORIES_DIR, memoryPath, view_range as [number, number] | undefined);
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
		const result = doCreate(MEMORIES_DIR, memoryPath, file_text);
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
		const result = doStrReplace(MEMORIES_DIR, memoryPath, old_str, new_str);
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
		const result = doInsert(MEMORIES_DIR, memoryPath, insert_line, insert_text);
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
		const result = doDelete(MEMORIES_DIR, memoryPath);
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
		const result = doRename(MEMORIES_DIR, old_path, new_path);
		return { content: [{ type: 'text' as const, text: result }] };
	},
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
	ensureMemoriesDir(MEMORIES_DIR);
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error('project-shared-memory MCP server running on stdio');
}

main().catch((err) => {
	console.error('Fatal error:', err);
	process.exit(1);
});
