import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
	doCreate,
	doView,
	doStrReplace,
	doInsert,
	doDelete,
	doRename,
} from './operations.js';

// ---------------------------------------------------------------------------
// Test fixture: isolated temp directory per test
// ---------------------------------------------------------------------------

let memoriesDir: string;

beforeEach(() => {
	memoriesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-test-'));
});

afterEach(() => {
	fs.rmSync(memoriesDir, { recursive: true, force: true });
});

/** Write a file into the temp memoriesDir (bypassing MCP logic) */
function writeFile(relativePath: string, content: string): void {
	const full = path.join(memoriesDir, relativePath);
	fs.mkdirSync(path.dirname(full), { recursive: true });
	fs.writeFileSync(full, content, 'utf-8');
}

/** Read a file from the temp memoriesDir */
function readFile(relativePath: string): string {
	return fs.readFileSync(path.join(memoriesDir, relativePath), 'utf-8');
}

// ---------------------------------------------------------------------------
// doCreate
// ---------------------------------------------------------------------------

describe('doCreate', () => {
	it('creates a new file with given content', () => {
		const result = doCreate(memoriesDir, '/memories/notes.md', 'hello world');
		expect(result).toBe('File created successfully at: /memories/notes.md');
		expect(readFile('notes.md')).toBe('hello world');
	});

	it('creates parent directories automatically', () => {
		const result = doCreate(memoriesDir, '/memories/sub/dir/file.md', 'data');
		expect(result).toBe('File created successfully at: /memories/sub/dir/file.md');
		expect(readFile('sub/dir/file.md')).toBe('data');
	});

	it('returns error if file already exists', () => {
		writeFile('notes.md', 'existing');
		const result = doCreate(memoriesDir, '/memories/notes.md', 'new content');
		expect(result).toMatch(/already exists/);
	});

	it('returns error for invalid path', () => {
		const result = doCreate(memoriesDir, '/bad/path.md', 'content');
		expect(result).toMatch(/Error:/);
	});

	it('returns error for path traversal attempt', () => {
		const result = doCreate(memoriesDir, '/memories/../evil.md', 'bad');
		expect(result).toMatch(/Path traversal is not allowed/);
	});
});

// ---------------------------------------------------------------------------
// doView
// ---------------------------------------------------------------------------

describe('doView', () => {
	it('returns file content with line numbers', () => {
		writeFile('notes.md', 'line1\nline2\nline3');
		const result = doView(memoriesDir, '/memories/notes.md');
		expect(result).toContain("Here's the content of /memories/notes.md with line numbers:");
		expect(result).toContain('     1\tline1');
		expect(result).toContain('     3\tline3');
	});

	it('returns not found message for non-existent file', () => {
		const result = doView(memoriesDir, '/memories/missing.md');
		expect(result).toMatch(/No memories found/);
	});

	it('returns directory listing for a directory path', () => {
		writeFile('sub/a.md', 'a');
		writeFile('sub/b.md', 'b');
		const result = doView(memoriesDir, '/memories/sub');
		expect(result).toContain('/memories/sub/a.md');
		expect(result).toContain('/memories/sub/b.md');
	});

	it('returns error for invalid path', () => {
		const result = doView(memoriesDir, '/wrong/path.md');
		expect(result).toMatch(/Error:/);
	});

	it('respects view_range for valid line range', () => {
		writeFile('notes.md', 'L1\nL2\nL3\nL4\nL5');
		const result = doView(memoriesDir, '/memories/notes.md', [2, 4]);
		expect(result).toContain('lines 2-4');
		expect(result).toContain('     2\tL2');
		expect(result).toContain('     4\tL4');
		expect(result).not.toContain('L1');
		expect(result).not.toContain('L5');
	});

	it('returns error for view_range start out of bounds', () => {
		writeFile('notes.md', 'only one line');
		const result = doView(memoriesDir, '/memories/notes.md', [5, 5]);
		expect(result).toMatch(/out of range/);
	});

	it('returns error for view_range end before start', () => {
		writeFile('notes.md', 'L1\nL2\nL3');
		const result = doView(memoriesDir, '/memories/notes.md', [3, 1]);
		expect(result).toMatch(/out of range/);
	});
});

// ---------------------------------------------------------------------------
// doStrReplace
// ---------------------------------------------------------------------------

describe('doStrReplace', () => {
	it('replaces unique string and returns snippet', () => {
		writeFile('notes.md', 'hello world\nhave a good day');
		const result = doStrReplace(memoriesDir, '/memories/notes.md', 'world', 'there');
		expect(result).toContain("The memory file has been edited");
		expect(readFile('notes.md')).toBe('hello there\nhave a good day');
	});

	it('returns error when old_str not found', () => {
		writeFile('notes.md', 'hello world');
		const result = doStrReplace(memoriesDir, '/memories/notes.md', 'nothere', 'x');
		expect(result).toMatch(/did not appear verbatim/);
	});

	it('returns error when old_str appears multiple times', () => {
		writeFile('notes.md', 'foo\nfoo\nbar');
		const result = doStrReplace(memoriesDir, '/memories/notes.md', 'foo', 'baz');
		expect(result).toMatch(/Multiple occurrences/);
		// file should be unchanged
		expect(readFile('notes.md')).toBe('foo\nfoo\nbar');
	});

	it('returns error when file does not exist', () => {
		const result = doStrReplace(memoriesDir, '/memories/missing.md', 'x', 'y');
		expect(result).toMatch(/does not exist/);
	});

	it('returns error for invalid path', () => {
		const result = doStrReplace(memoriesDir, '/bad/path.md', 'x', 'y');
		expect(result).toMatch(/Error:/);
	});

	it('can replace with empty string (deletion)', () => {
		writeFile('notes.md', 'keep this remove_me done');
		doStrReplace(memoriesDir, '/memories/notes.md', ' remove_me', '');
		expect(readFile('notes.md')).toBe('keep this done');
	});
});

// ---------------------------------------------------------------------------
// doInsert
// ---------------------------------------------------------------------------

describe('doInsert', () => {
	it('inserts at line 0 (before all content)', () => {
		writeFile('notes.md', 'line1\nline2');
		doInsert(memoriesDir, '/memories/notes.md', 0, 'prepended');
		expect(readFile('notes.md')).toBe('prepended\nline1\nline2');
	});

	it('inserts after last line', () => {
		writeFile('notes.md', 'line1\nline2');
		doInsert(memoriesDir, '/memories/notes.md', 2, 'appended');
		expect(readFile('notes.md')).toBe('line1\nline2\nappended');
	});

	it('inserts in the middle', () => {
		writeFile('notes.md', 'line1\nline3');
		doInsert(memoriesDir, '/memories/notes.md', 1, 'line2');
		expect(readFile('notes.md')).toBe('line1\nline2\nline3');
	});

	it('returns error for out-of-range insert_line', () => {
		writeFile('notes.md', 'only one line');
		const result = doInsert(memoriesDir, '/memories/notes.md', 99, 'x');
		expect(result).toMatch(/Invalid.*insert_line/);
	});

	it('returns error when file does not exist', () => {
		const result = doInsert(memoriesDir, '/memories/ghost.md', 0, 'x');
		expect(result).toMatch(/does not exist/);
	});

	it('returns snippet result on success', () => {
		writeFile('notes.md', 'a\nb\nc');
		const result = doInsert(memoriesDir, '/memories/notes.md', 1, 'inserted');
		expect(result).toContain('The memory file has been edited');
	});
});

// ---------------------------------------------------------------------------
// doDelete
// ---------------------------------------------------------------------------

describe('doDelete', () => {
	it('deletes an existing file', () => {
		writeFile('notes.md', 'content');
		const result = doDelete(memoriesDir, '/memories/notes.md');
		expect(result).toBe('Successfully deleted /memories/notes.md');
		expect(fs.existsSync(path.join(memoriesDir, 'notes.md'))).toBe(false);
	});

	it('deletes a directory recursively', () => {
		writeFile('sub/a.md', 'a');
		writeFile('sub/b.md', 'b');
		const result = doDelete(memoriesDir, '/memories/sub');
		expect(result).toBe('Successfully deleted /memories/sub');
		expect(fs.existsSync(path.join(memoriesDir, 'sub'))).toBe(false);
	});

	it('returns error for non-existent path', () => {
		const result = doDelete(memoriesDir, '/memories/ghost.md');
		expect(result).toMatch(/does not exist/);
	});

	it('returns error for invalid path', () => {
		const result = doDelete(memoriesDir, '/wrong/path.md');
		expect(result).toMatch(/Error:/);
	});
});

// ---------------------------------------------------------------------------
// doRename
// ---------------------------------------------------------------------------

describe('doRename', () => {
	it('renames a file', () => {
		writeFile('old.md', 'data');
		const result = doRename(memoriesDir, '/memories/old.md', '/memories/new.md');
		expect(result).toBe('Successfully renamed /memories/old.md to /memories/new.md');
		expect(fs.existsSync(path.join(memoriesDir, 'old.md'))).toBe(false);
		expect(readFile('new.md')).toBe('data');
	});

	it('moves a file into a subdirectory', () => {
		writeFile('notes.md', 'content');
		const result = doRename(memoriesDir, '/memories/notes.md', '/memories/sub/notes.md');
		expect(result).toContain('Successfully renamed');
		expect(readFile('sub/notes.md')).toBe('content');
	});

	it('returns error when source does not exist', () => {
		const result = doRename(memoriesDir, '/memories/ghost.md', '/memories/new.md');
		expect(result).toMatch(/does not exist/);
	});

	it('returns error when destination already exists', () => {
		writeFile('a.md', 'a');
		writeFile('b.md', 'b');
		const result = doRename(memoriesDir, '/memories/a.md', '/memories/b.md');
		expect(result).toMatch(/already exists/);
	});

	it('returns error for invalid old path', () => {
		const result = doRename(memoriesDir, '/bad/path.md', '/memories/new.md');
		expect(result).toMatch(/Error:/);
	});

	it('returns error for invalid new path', () => {
		writeFile('a.md', 'a');
		const result = doRename(memoriesDir, '/memories/a.md', '/bad/new.md');
		expect(result).toMatch(/Error:/);
	});
});
