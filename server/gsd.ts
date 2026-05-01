// GSD planning file parsing and patching — pure functions, no I/O

export function escRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export type PhasePlan = {
  file: string;
  name: string;
  completed: boolean;
};

export type PhaseDraft = {
  number: number;
  name: string;
  goal: string;
  completed: boolean;
  plans: PhasePlan[];
};

export function parseRoadmapMd(content: string): PhaseDraft[] {
  const lines = content.split('\n');
  const phases: PhaseDraft[] = [];
  let inPhasesSection = false;
  let currentPhase: PhaseDraft | null = null;
  let inPlans = false;

  for (const line of lines) {
    if (/^## Phases/.test(line)) { inPhasesSection = true; continue; }
    if (/^## /.test(line) && !/^## Phases/.test(line)) { inPhasesSection = false; }

    if (inPhasesSection) {
      const m = line.match(/^- \[([x ])\] \*\*Phase (\d+(?:\.\d+)?): ([^*]+)\*\*/);
      if (m) phases.push({ number: parseFloat(m[2]), name: m[3].trim(), goal: '', completed: m[1] === 'x', plans: [] });
    }

    const detailM = line.match(/^### Phase (\d+(?:\.\d+)?): /);
    if (detailM) {
      currentPhase = phases.find(p => p.number === parseFloat(detailM[1])) ?? null;
      inPlans = false;
      continue;
    }

    if (currentPhase) {
      const goalM = line.match(/^\*\*Goal\*\*: (.+)/);
      if (goalM) { currentPhase.goal = goalM[1].trim(); }
      if (line.trim() === 'Plans:') { inPlans = true; continue; }
      if (inPlans) {
        if (!line.startsWith('- ')) { inPlans = false; continue; }
        const planM = line.match(/^- \[([x ])\] (\S+\.md) — (.+)/);
        if (planM) currentPhase.plans.push({ file: planM[2].trim(), name: planM[3].trim(), completed: planM[1] === 'x' });
      }
    }
  }
  return phases;
}

export type QuickTask = {
  number: number;
  description: string;
  date: string;
  dirPath: string;
};

export type StateData = {
  milestone: string;
  milestoneName: string;
  status: string;
  progress: {
    totalPhases: number;
    completedPhases: number;
    totalPlans: number;
    completedPlans: number;
    percent: number;
  };
  quickTasks: QuickTask[];
};

export function parseStateMd(content: string): StateData {
  const fmM = content.match(/^---\n([\s\S]+?)\n---/);
  const fm = fmM?.[1] ?? '';
  const str = (re: RegExp) => (fm.match(re)?.[1] ?? '').trim().replace(/^["']|["']$/g, '');
  const num = (re: RegExp) => parseInt((fm.match(re)?.[1] ?? '0'));

  const quickTasks: QuickTask[] = [];
  const tableRe = /^\| (\d+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|/gm;
  let m: RegExpExecArray | null;
  while ((m = tableRe.exec(content)) !== null) {
    const n = parseInt(m[1]);
    if (isNaN(n)) continue;
    const pathM = m[5].match(/\(([^)]+)\)/);
    quickTasks.push({ number: n, description: m[2].trim(), date: m[3].trim(), dirPath: pathM?.[1] ?? '' });
  }

  return {
    milestone: str(/^milestone:\s*(.+)$/m),
    milestoneName: str(/^milestone_name:\s*(.+)$/m),
    status: str(/^status:\s*(.+)$/m),
    progress: {
      totalPhases: num(/total_phases:\s*(\d+)/m),
      completedPhases: num(/completed_phases:\s*(\d+)/m),
      totalPlans: num(/total_plans:\s*(\d+)/m),
      completedPlans: num(/completed_plans:\s*(\d+)/m),
      percent: num(/percent:\s*(\d+)/m),
    },
    quickTasks,
  };
}

export function patchRoadmapRemovePlan(content: string, phaseNum: number, planId: string): string {
  const planLineRe = new RegExp(`^- \\[[ x]\\] ${escRe(planId)}-PLAN\\.md[^\\n]*\\n?`, 'm');
  let updated = content.replace(planLineRe, '');
  const countRe = new RegExp(`(### Phase ${phaseNum}[^\\d][\\s\\S]*?\\*\\*Plans\\*\\*: )(\\d+)( plans)`);
  updated = updated.replace(countRe, (_, pre, n, post) => `${pre}${Math.max(0, parseInt(n) - 1)}${post}`);
  return updated;
}
