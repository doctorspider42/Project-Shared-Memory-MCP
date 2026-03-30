import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import {
	validatePath,
	resolveMemoryPath,
	normalizePath,
	isMemoriesRoot,
	formatLineNumber,
	formatFileContent,
	makeSnippet,
} from './utils.js';

// ---------------------------------------------------------------------------
// validatePath
// ---------------------------------------------------------------------------

describe('validatePath', () => {
	it('returns undefined for a valid file path', () => {
		expect(validatePath('/memories/notes.md')).toBeUndefined();
	});

	it('returns undefined for nested path', () => {
		expect(validatePath('/memories/sub/dir/file.md')).toBeUndefined();
	});

	it('returns undefined for root path without trailing slash', () => {
		expect(validatePath('/memories')).toBeUndefined();
	});

	it('returns undefined for root path with trailing slash', () => {
		expect(validatePath('/memories/')).toBeUndefined();
	});

	it('returns error when path does not start with /memories/', () => {
		const result = validatePath('/other/path.md');
		expect(result).toMatch(/start with \/memories\//);
	});

	it('returns error for empty-like path', () => {
		const result = validatePath('/');
		expect(result).toMatch(/start with \/memories\//);
	});

	it('returns error for path traversal using ..', () => {
		const result = validatePath('/memories/../etc/passwd');
		expect(result).toMatch(/Path traversal is not allowed/);
	});

	it('returns error for .. embedded in segment', () => {
		const result = validatePath('/memories/foo/../bar');
		expect(result).toMatch(/Path traversal is not allowed/);
	});

	it('returns error for single dot segment', () => {
		const result = validatePath('/memories/./notes.md');
		expect(result).toMatch(/Path traversal is not allowed/);
	});

	it('returns error for path not starting with /memories', () => {
		const result = validatePath('memories/notes.md');
		expect(result).toMatch(/start with \/memories\//);
	});
});

// ---------------------------------------------------------------------------
// resolveMemoryPath
// ---------------------------------------------------------------------------

describe('resolveMemoryPath', () => {
	const memoriesDir = path.join('fake', 'project', '.github', 'memories');

	it('maps /memories/notes.md to memoriesDir/notes.md', () => {
		const result = resolveMemoryPath(memoriesDir, '/memories/notes.md');
		expect(result).toBe(path.join(memoriesDir, 'notes.md'));
	});

	it('maps /memories/sub/dir/file.md to nested path', () => {
		const result = resolveMemoryPath(memoriesDir, '/memories/sub/dir/file.md');
		expect(result).toBe(path.join(memoriesDir, 'sub', 'dir', 'file.md'));
	});

	it('maps /memories (root) to memoriesDir itself', () => {
		const result = resolveMemoryPath(memoriesDir, '/memories');
		expect(result).toBe(memoriesDir);
	});

	it('maps /memories/ (root with slash) to memoriesDir itself', () => {
		const result = resolveMemoryPath(memoriesDir, '/memories/');
		expect(result).toBe(memoriesDir);
	});
});

// ---------------------------------------------------------------------------
// normalizePath
// ---------------------------------------------------------------------------

describe('normalizePath', () => {
	it('adds trailing slash when missing', () => {
		expect(normalizePath('/memories')).toBe('/memories/');
	});

	it('keeps trailing slash when already present', () => {
		expect(normalizePath('/memories/')).toBe('/memories/');
	});

	it('works for arbitrary strings', () => {
		expect(normalizePath('/a/b/c')).toBe('/a/b/c/');
	});
});

// ---------------------------------------------------------------------------
// isMemoriesRoot
// ---------------------------------------------------------------------------

describe('isMemoriesRoot', () => {
	it('returns true for /memories/', () => {
		expect(isMemoriesRoot('/memories/')).toBe(true);
	});

	it('returns true for /memories (no trailing slash)', () => {
		expect(isMemoriesRoot('/memories')).toBe(true);
	});

	it('returns false for /memories/notes.md', () => {
		expect(isMemoriesRoot('/memories/notes.md')).toBe(false);
	});

	it('returns false for /memories/sub/', () => {
		expect(isMemoriesRoot('/memories/sub/')).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// formatLineNumber
// ---------------------------------------------------------------------------

describe('formatLineNumber', () => {
	it('pads single digit to 6 chars', () => {
		expect(formatLineNumber(1)).toBe('     1');
	});

	it('pads two digits to 6 chars', () => {
		expect(formatLineNumber(42)).toBe('    42');
	});

	it('pads three digits to 6 chars', () => {
		expect(formatLineNumber(100)).toBe('   100');
	});

	it('does not truncate 6-digit numbers', () => {
		expect(formatLineNumber(123456)).toBe('123456');
	});
});

// ---------------------------------------------------------------------------
// formatFileContent
// ---------------------------------------------------------------------------

describe('formatFileContent', () => {
	it('adds header with path', () => {
		const result = formatFileContent('/memories/test.md', 'line1\nline2');
		expect(result).toContain("Here's the content of /memories/test.md with line numbers:");
	});

	it('numbers lines starting at 1', () => {
		const result = formatFileContent('/memories/test.md', 'alpha\nbeta');
		expect(result).toContain('     1\talpha');
		expect(result).toContain('     2\tbeta');
	});

	it('handles single-line content', () => {
		const result = formatFileContent('/memories/single.md', 'only line');
		expect(result).toContain('     1\tonly line');
	});

	it('handles empty content', () => {
		const result = formatFileContent('/memories/empty.md', '');
		expect(result).toContain('     1\t');
	});
});

// ---------------------------------------------------------------------------
// makeSnippet
// ---------------------------------------------------------------------------

describe('makeSnippet', () => {
	const twoLines = 'line1\nline2';
	const tenLines = Array.from({ length: 10 }, (_, i) => `line${i + 1}`).join('\n');

	it('includes header with path', () => {
		const result = makeSnippet(twoLines, 1, '/memories/test.md');
		expect(result).toContain('/memories/test.md');
		expect(result).toContain("Here's the result of running `cat -n`");
	});

	it('clamps start at line 1 for edit near top', () => {
		// editLine=1, snippetRadius=4 → start=max(0,-3)=0 → first snippet line is line 1
		const result = makeSnippet(tenLines, 1, '/memories/test.md');
		expect(result).toContain('     1\tline1');
	});

	it('clamps end at file length for edit near bottom', () => {
		// editLine=10, snippetRadius=4 → end=min(10,13)=10 → last snippet line is line 10
		const result = makeSnippet(tenLines, 10, '/memories/test.md');
		expect(result).toContain('    10\tline10');
		expect(result).not.toContain('line11');
	});

	it('shows window of 9 lines for edit in the middle', () => {
		const twentyLines = Array.from({ length: 20 }, (_, i) => `L${i + 1}`).join('\n');
		// editLine=10, window = lines [6..14] = 9 lines
		const result = makeSnippet(twentyLines, 10, '/memories/test.md');
		expect(result).toContain('     6\tL6');
		expect(result).toContain('    14\tL14');
		expect(result).not.toContain('     5\t');
		expect(result).not.toContain('    15\t');
	});
});
