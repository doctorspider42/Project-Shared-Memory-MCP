---
name: test-project-shared-memory
description: "Smoke-test the project-shared-memory MCP server. Use when testing, validating, or verifying the project-shared-memory MCP. Runs a full CRUD lifecycle across all scopes (user, repo, session): connectivity check, create, read, update (str_replace), insert, rename, delete — with verification after every mutation."
argument-hint: "Optional: specify which MCP backend to test (local or docker). Defaults to whichever is reachable."
---

# Test Project Memory MCP

Run a structured smoke-test suite against the project-shared-memory MCP server and report pass/fail for each step.

## Tools Under Test

Use the `project-shared-memory-local` or `project-shared-memory-docker` MCP tools (whichever the user specifies, or whichever is reachable). The six operations tested:

| Tool | Purpose |
|------|---------|
| `memory_view` | Connectivity check + read |
| `memory_create` | Write new files |
| `memory_str_replace` | Update content |
| `memory_insert` | Insert content by line number |
| `memory_rename` | Rename/move files |
| `memory_delete` | Delete files and directories |

## Memory Scopes

The server supports three scopes:

| Scope | Virtual Path | Storage Path |
|-------|-------------|-------------|
| User | `/memories/xxx` | `.github/memories/user/xxx` |
| Repo | `/memories/repo/xxx` | `.github/memories/repo/xxx` |
| Session | `/memories/session/xxx` | `.github/memories/session/xxx` |

## Constraints

- DO NOT modify any existing memories outside of `/memories/test-suite/` and `/memories/repo/test-suite/`
- DO NOT leave any test artefacts behind — always clean up even if a step fails
- ONLY report truthfully; never mark a step as PASS if the tool returned an error
- DO NOT skip verification steps — every mutating action must be followed by a `memory_view` confirmation

## Procedure

Use the todo list to track progress. After every mutating call, immediately call `memory_view` to confirm the change took effect.

### Stage 0 — Connectivity Check
1. Call `memory_view` with path `/memories/`
2. If it succeeds → mark connectivity as **PASS** and proceed
3. If it errors → report the error, mark as **FAIL**, and stop (do not attempt further stages)

### Stage 1 — Create (User Scope)
1. Create `/memories/test-suite/alpha.md` with content: `# Alpha\nThis is test file alpha.`
2. Create `/memories/test-suite/beta.md` with content: `# Beta\nThis is test file beta.`
3. Create `/memories/test-suite/gamma.md` with content: `# Gamma\nThis is test file gamma.`
4. Verify: call `memory_view` on `/memories/test-suite/` and confirm all three files are listed
5. Verify: call `memory_view` on `/memories/test-suite/alpha.md` and confirm the content matches exactly

### Stage 2 — Create (Repo Scope)
1. Create `/memories/repo/test-suite/repo-note.md` with content: `# Repo Note\nThis is a repo-scoped memory.`
2. Verify: call `memory_view` on `/memories/repo/test-suite/repo-note.md` and confirm the content matches
3. Verify: call `memory_view` on `/memories/repo/test-suite/` and confirm the file is listed

### Stage 3 — Update (str_replace)
1. Call `memory_str_replace` on `/memories/test-suite/alpha.md`: replace `This is test file alpha.` with `This is test file alpha. [UPDATED]`
2. Verify: call `memory_view` on `/memories/test-suite/alpha.md` and confirm the updated text is present and the old text is gone

### Stage 4 — Insert
1. Call `memory_insert` on `/memories/test-suite/beta.md` at line 0: insert text `<!-- inserted at top -->\n`
2. Verify: call `memory_view` on `/memories/test-suite/beta.md` and confirm the inserted line appears at the top

### Stage 5 — Rename
1. Call `memory_rename`: rename `/memories/test-suite/gamma.md` to `/memories/test-suite/gamma-renamed.md`
2. Verify: call `memory_view` on `/memories/test-suite/` and confirm `gamma-renamed.md` is listed and `gamma.md` is gone

### Stage 6 — Root Listing Verification
1. Call `memory_view` on `/memories/` and confirm:
   - User files appear at root level (e.g. `test-suite/` visible directly)
   - `repo/` scope directory is visible with `test-suite/` inside it
   - No `user/` directory is exposed (it's an implementation detail)

### Stage 7 — Verify Actual Files (Pre-Delete)
1. Check the actual `.github/memories/` directory on the file system to confirm:
   - User-scoped files are stored under `.github/memories/user/test-suite/`
   - Repo-scoped files are stored under `.github/memories/repo/test-suite/`
   - File contents match what was set via the memory tools
   - The directory structure reflects all mutations (renames, deletions, insertions)
2. Report the actual file paths and content to confirm the MCP operations affected the underlying filesystem correctly

### Stage 8 — Delete & Cleanup
1. Call `memory_delete` on `/memories/test-suite/` to remove the user-scoped test directory
2. Call `memory_delete` on `/memories/repo/test-suite/` to remove the repo-scoped test directory
3. Verify: call `memory_view` on `/memories/` and confirm `test-suite/` no longer appears in any scope
4. Verify on the file system: check that `.github/memories/user/test-suite/` and `.github/memories/repo/test-suite/` no longer exist on disk

## Output Format

After all stages complete, print a **Test Report** in this exact format:

```
## Project Shared Memory MCP — Test Report

| Stage | Test                           | Result |
|-------|--------------------------------|--------|
| 0     | Connectivity (memory_view)     | ✅ PASS / ❌ FAIL |
| 1a    | Create alpha.md (user)         | ✅ PASS / ❌ FAIL |
| 1b    | Create beta.md (user)          | ✅ PASS / ❌ FAIL |
| 1c    | Create gamma.md (user)         | ✅ PASS / ❌ FAIL |
| 1d    | Verify user directory listing  | ✅ PASS / ❌ FAIL |
| 2a    | Create repo-note.md (repo)     | ✅ PASS / ❌ FAIL |
| 2b    | Verify repo directory listing  | ✅ PASS / ❌ FAIL |
| 3     | str_replace (update)           | ✅ PASS / ❌ FAIL |
| 4     | insert (line 0)                | ✅ PASS / ❌ FAIL |
| 5     | rename gamma → gamma-renamed   | ✅ PASS / ❌ FAIL |
| 6     | Root listing scope visibility  | ✅ PASS / ❌ FAIL |
| 7     | Verify actual filesystem paths | ✅ PASS / ❌ FAIL |
| 8a    | delete user test-suite/        | ✅ PASS / ❌ FAIL |
| 8b    | delete repo test-suite/        | ✅ PASS / ❌ FAIL |
| 8c    | Verify deletion on filesystem  | ✅ PASS / ❌ FAIL |

**Overall: X/15 PASS**
```

If any stage fails, append a **Failures** section listing the error message returned by the tool.
---
name: test-project-shared-memory
description: "Smoke-test the project-shared-memory MCP server. Use when testing, validating, or verifying the project-shared-memory MCP. Runs a full CRUD lifecycle: connectivity check, create, read, update (str_replace), insert, rename, delete — with verification after every mutation."
argument-hint: "Optional: specify which MCP backend to test (local or docker). Defaults to whichever is reachable."
---

# Test Project Memory MCP

Run a structured smoke-test suite against the project-shared-memory MCP server and report pass/fail for each step.

## Tools Under Test

Use the `project-shared-memory-local` or `project-shared-memory-docker` MCP tools (whichever the user specifies, or whichever is reachable). The six operations tested:

| Tool | Purpose |
|------|---------|
| `memory_view` | Connectivity check + read |
| `memory_create` | Write new files |
| `memory_str_replace` | Update content |
| `memory_insert` | Insert content by line number |
| `memory_rename` | Rename/move files |
| `memory_delete` | Delete files and directories |

## Constraints

- DO NOT modify any existing memories outside of `/memories/test-suite/`
- DO NOT leave any test artefacts behind — always clean up even if a step fails
- ONLY report truthfully; never mark a step as PASS if the tool returned an error
- DO NOT skip verification steps — every mutating action must be followed by a `memory_view` confirmation

## Procedure

Use the todo list to track progress. After every mutating call, immediately call `memory_view` to confirm the change took effect.

### Stage 0 — Connectivity Check
1. Call `memory_view` with path `/memories/`
2. If it succeeds → mark connectivity as **PASS** and proceed
3. If it errors → report the error, mark as **FAIL**, and stop (do not attempt further stages)

### Stage 1 — Create
1. Create `/memories/test-suite/alpha.md` with content: `# Alpha\nThis is test file alpha.`
2. Create `/memories/test-suite/beta.md` with content: `# Beta\nThis is test file beta.`
3. Create `/memories/test-suite/gamma.md` with content: `# Gamma\nThis is test file gamma.`
4. Verify: call `memory_view` on `/memories/test-suite/` and confirm all three files are listed
5. Verify: call `memory_view` on `/memories/test-suite/alpha.md` and confirm the content matches exactly

### Stage 2 — Update (str_replace)
1. Call `memory_str_replace` on `/memories/test-suite/alpha.md`: replace `This is test file alpha.` with `This is test file alpha. [UPDATED]`
2. Verify: call `memory_view` on `/memories/test-suite/alpha.md` and confirm the updated text is present and the old text is gone

### Stage 3 — Insert
1. Call `memory_insert` on `/memories/test-suite/beta.md` at line 0: insert text `<!-- inserted at top -->\n`
2. Verify: call `memory_view` on `/memories/test-suite/beta.md` and confirm the inserted line appears at the top

### Stage 4 — Rename
1. Call `memory_rename`: rename `/memories/test-suite/gamma.md` to `/memories/test-suite/gamma-renamed.md`
2. Verify: call `memory_view` on `/memories/test-suite/` and confirm `gamma-renamed.md` is listed and `gamma.md` is gone

### Stage 5 — Verify Actual Files (Pre-Delete)
1. Check the actual `.github/memories/` directory on the file system to confirm:
   - All memory files created during the test persist in their correct locations
   - File contents match what was set via the memory tools
   - The directory structure reflects all mutations (renames, deletions, insertions)
2. Report the actual file paths and content to confirm the MCP operations affected the underlying filesystem correctly

### Stage 6 — Delete & Cleanup
1. Call `memory_delete` on `/memories/test-suite/` to remove the entire test directory
2. Verify: call `memory_view` on `/memories/` and confirm `test-suite/` no longer appears in the listing
3. Verify on the file system: check that `.github/memories/test-suite/` no longer exists on disk — confirm the directory and all its files have been physically removed

## Output Format

After all stages complete, print a **Test Report** in this exact format:

```
## Project Shared Memory MCP — Test Report

| Stage | Test                        | Result |
|-------|-----------------------------|--------|
| 0     | Connectivity (memory_view)  | ✅ PASS / ❌ FAIL |
| 1a    | Create alpha.md             | ✅ PASS / ❌ FAIL |
| 1b    | Create beta.md              | ✅ PASS / ❌ FAIL |
| 1c    | Create gamma.md             | ✅ PASS / ❌ FAIL |
| 1d    | Verify directory listing    | ✅ PASS / ❌ FAIL |
| 2     | str_replace (update)        | ✅ PASS / ❌ FAIL |
| 3     | insert (line 0)             | ✅ PASS / ❌ FAIL |
| 4     | rename gamma → gamma-renamed| ✅ PASS / ❌ FAIL |
| 5     | Verify actual .github/memories files | ✅ PASS / ❌ FAIL |
| 6a    | delete test-suite/          | ✅ PASS / ❌ FAIL |
| 6b    | Verify deletion on filesystem | ✅ PASS / ❌ FAIL |

**Overall: X/11 PASS**
```

If any stage fails, append a **Failures** section listing the error message returned by the tool.
