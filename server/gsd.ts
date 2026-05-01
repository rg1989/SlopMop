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

  // Pass 1: scan ## Phases overview list → build completedMap
  const completedMap = new Map<number, boolean>();
  let inPhasesOverview = false;
  for (const line of lines) {
    if (/^## Phases/.test(line)) { inPhasesOverview = true; continue; }
    if (/^## /.test(line) && !/^## Phases/.test(line)) { inPhasesOverview = false; continue; }
    if (inPhasesOverview) {
      const m = line.match(/^- \[([x ])\] \*\*Phase (\d+(?:\.\d+)?): /);
      if (m) completedMap.set(parseFloat(m[2]), m[1] === 'x');
    }
  }

  // Pass 2: scan ### Phase N: detail sections → build phases array directly
  const phases: PhaseDraft[] = [];
  let currentPhase: PhaseDraft | null = null;
  let inPlans = false;

  for (const line of lines) {
    const detailM = line.match(/^### Phase (\d+(?:\.\d+)?): (.+)/);
    if (detailM) {
      const num = parseFloat(detailM[1]);
      const name = detailM[2].trim();
      currentPhase = {
        number: num,
        name,
        goal: '',
        completed: completedMap.get(num) ?? false,
        plans: [],
      };
      phases.push(currentPhase);
      inPlans = false;
      continue;
    }

    if (currentPhase) {
      const goalM = line.match(/^\*\*Goal\*\*: (.+)/);
      if (goalM) { currentPhase.goal = goalM[1].trim(); continue; }
      if (line.trim() === 'Plans:') { inPlans = true; continue; }
      if (/^### /.test(line)) { inPlans = false; continue; }
      if (inPlans) {
        if (!line.startsWith('- ')) { inPlans = false; continue; }
        const planM = line.match(/^- \[([x ])\] (\S+\.md) — (.+)/);
        if (planM) currentPhase.plans.push({ file: planM[2].trim(), name: planM[3].trim(), completed: planM[1] === 'x' });
      }
    }
  }

  return phases.sort((a, b) => a.number - b.number);
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
