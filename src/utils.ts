import * as path from 'node:path';

/**
 * Validates a virtual memory path.
 * Returns an error string if invalid, or undefined if valid.
 */
export function validatePath(memoryPath: string): string | undefined {
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

/**
 * Maps a virtual /memories/... path to a real filesystem path under memoriesDir.
 */
export function resolveMemoryPath(memoriesDir: string, memoryPath: string): string {
	const segments = memoryPath.split('/').filter(s => s.length > 0);
	// segments[0] === 'memories', rest are relative
	const relative = segments.slice(1);
	const scope = getScope(memoryPath);

	if (scope === 'repo' || scope === 'session') {
		// /memories/repo/x.md → memoriesDir/repo/x.md (scope prefix stays in path)
		if (relative.length === 0) {
			return memoriesDir;
		}
		return path.join(memoriesDir, ...relative);
	}

	// User scope: /memories/x.md → memoriesDir/user/x.md
	return path.join(memoriesDir, 'user', ...relative);
}

export function normalizePath(p: string): string {
	return p.endsWith('/') ? p : p + '/';
}

export function isMemoriesRoot(p: string): boolean {
	return normalizePath(p) === '/memories/';
}

export type MemoryScope = 'user' | 'repo' | 'session';

export function isRepoPath(memoryPath: string): boolean {
	return normalizePath(memoryPath).startsWith('/memories/repo/');
}

export function isSessionPath(memoryPath: string): boolean {
	return normalizePath(memoryPath).startsWith('/memories/session/');
}

export function getScope(memoryPath: string): MemoryScope {
	if (isRepoPath(memoryPath)) return 'repo';
	if (isSessionPath(memoryPath)) return 'session';
	return 'user';
}

export function formatLineNumber(line: number): string {
	return String(line).padStart(6, ' ');
}

export function formatFileContent(memoryPath: string, content: string): string {
	const lines = content.split('\n');
	const numbered = lines.map((line, i) => `${formatLineNumber(i + 1)}\t${line}`);
	return `Here's the content of ${memoryPath} with line numbers:\n${numbered.join('\n')}`;
}

export function makeSnippet(fileContent: string, editLine: number, memoryPath: string): string {
	const lines = fileContent.split('\n');
	const snippetRadius = 4;
	const start = Math.max(0, editLine - 1 - snippetRadius);
	const end = Math.min(lines.length, editLine - 1 + snippetRadius + 1);
	const snippet = lines.slice(start, end);
	const numbered = snippet.map((line, i) => `${formatLineNumber(start + i + 1)}\t${line}`);
	return `The memory file has been edited. Here's the result of running \`cat -n\` on a snippet of ${memoryPath}:\n${numbered.join('\n')}`;
}
