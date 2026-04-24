import { $ } from "bun";
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

export interface VaultSummary {
  oracle: string;
  vault_path: string;
  recent_commits: string[];
  new_learnings: FileEntry[];
  new_retros: FileEntry[];
  new_outbox: FileEntry[];
}

export interface FileEntry {
  path: string;
  content_preview: string; // first 2000 chars
  modified: Date;
}

const LOOKBACK_DAYS = 7;

export async function aggregateVaults(
  vaultPaths: Record<string, string>,
): Promise<VaultSummary[]> {
  const summaries: VaultSummary[] = [];
  const since = new Date();
  since.setDate(since.getDate() - LOOKBACK_DAYS);

  for (const [oracle, vaultPath] of Object.entries(vaultPaths)) {
    try {
      const summary = await aggregateOne(oracle, vaultPath, since);
      summaries.push(summary);
    } catch (err) {
      console.error(`[vault] Failed to aggregate ${oracle}: ${err}`);
    }
  }

  return summaries;
}

async function aggregateOne(oracle: string, vaultPath: string, since: Date): Promise<VaultSummary> {
  const repo = vaultPath.replace(/\/ψ$/, "");
  const commits = await getRecentCommits(repo);
  const new_learnings = await scanDir(join(vaultPath, "memory/learnings"), since);
  const new_retros = await scanDir(join(vaultPath, "memory/retrospectives"), since, true);
  const new_outbox = await scanDir(join(vaultPath, "outbox"), since);

  return {
    oracle,
    vault_path: vaultPath,
    recent_commits: commits,
    new_learnings,
    new_retros,
    new_outbox,
  };
}

async function getRecentCommits(repo: string): Promise<string[]> {
  try {
    const out = await $`git -C ${repo} log --since=${`${LOOKBACK_DAYS}.days.ago`} --format=%h:%s`.text();
    return out.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

async function scanDir(dir: string, since: Date, recursive = false): Promise<FileEntry[]> {
  const results: FileEntry[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory() && recursive) {
        results.push(...(await scanDir(full, since, true)));
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      if (entry.name === ".gitkeep") continue;

      const s = await stat(full);
      if (s.mtime < since) continue;

      const content = await readFile(full, "utf-8");
      results.push({
        path: full,
        content_preview: content.slice(0, 2000),
        modified: s.mtime,
      });
    }
  } catch {
    // dir doesn't exist; skip
  }
  return results;
}

export function formatVaultDigest(s: VaultSummary): string {
  const lines: string[] = [`### ${s.oracle}`, ""];
  if (s.recent_commits.length > 0) {
    lines.push(`**Commits (last ${LOOKBACK_DAYS} days)**:`);
    for (const c of s.recent_commits.slice(0, 20)) lines.push(`- ${c}`);
    lines.push("");
  }
  if (s.new_learnings.length > 0) {
    lines.push(`**New learnings**: ${s.new_learnings.length}`);
    for (const f of s.new_learnings.slice(0, 5)) {
      lines.push(`- ${f.path.split("/").pop()} (${f.modified.toISOString().slice(0, 10)})`);
      lines.push(`\`\`\`\n${f.content_preview.slice(0, 800)}\n\`\`\``);
    }
  }
  if (s.new_retros.length > 0) {
    lines.push(`**New retrospectives**: ${s.new_retros.length}`);
    for (const f of s.new_retros.slice(0, 3)) {
      lines.push(`- ${f.path.split("/").slice(-2).join("/")} (${f.modified.toISOString().slice(0, 10)})`);
      lines.push(`\`\`\`\n${f.content_preview.slice(0, 600)}\n\`\`\``);
    }
  }
  if (s.new_outbox.length > 0) {
    lines.push(`**New outbox letters**: ${s.new_outbox.length}`);
    for (const f of s.new_outbox.slice(0, 3)) {
      lines.push(`- ${f.path.split("/").pop()} (${f.modified.toISOString().slice(0, 10)})`);
    }
  }
  lines.push("");
  return lines.join("\n");
}
