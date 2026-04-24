export interface LoopLog {
  loop_id: string;
  started: string;
  ended: string;
  duration_s: number;
  cost_usd: number;
  cost_summary: string;
  proposal_path: string;
  github_issue_url: string | null;
  questions_generated: number;
  oracles_summarized: number;
}

export interface DashboardData {
  loops: LoopLog[];
  proposals: Record<string, string>; // loop_id → markdown content
  generated_at: string;
  family_roster: OracleInfo[];
}

export interface OracleInfo {
  name: string;
  emoji: string;
  role: string;
  model: string;
  registry: string;
}
