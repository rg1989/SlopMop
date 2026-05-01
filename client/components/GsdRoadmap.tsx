import { useState, useEffect, useCallback, useRef, type FC } from 'react';
import { ConfirmModal } from './ConfirmModal';
import { GsdAddModal, ADD_OPTIONS, type AddOption } from './GsdAddModal';

interface GsdPlan {
  id: string;
  name: string;
  completed: boolean;
  planPath: string | null;
  summaryPath: string | null;
}

interface GsdPhase {
  number: number;
  name: string;
  goal: string;
  completed: boolean;
  dirName: string;
  researchPath: string | null;
  verificationPath: string | null;
  plans: GsdPlan[];
}

interface GsdQuickTask {
  number: number;
  description: string;
  date: string;
  completed: boolean;
  dirName: string;
  planPath: string | null;
}

interface GsdRoadmapData {
  exists: true;
  milestone: string;
  milestoneName: string;
  status: string;
  progress: { totalPhases: number; completedPhases: number; totalPlans: number; completedPlans: number; percent: number };
  phases: GsdPhase[];
  quickTasks: GsdQuickTask[];
  roadmapPath: string;
  statePath: string;
  projectPath: string | null;
  requirementsPath: string | null;
}

type RoadmapResponse = { exists: false } | GsdRoadmapData;

interface GsdRoadmapProps {
  cwd: string;
  onOpenFile: (path: string, isPreview: boolean) => void;
  activeFilePath?: string;
  onSendCommand?: (command: string) => void;
}

const IconCheck = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const IconBolt = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);

const IconChevron = ({ open }: { open: boolean }) => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

const IconMap = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
    <line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
  </svg>
);

const IconTrashSm = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);

const IconPlus = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const IconFile = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
);

const IconLayers = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2"/>
    <polyline points="2 17 12 22 22 17"/>
    <polyline points="2 12 12 17 22 12"/>
  </svg>
);

function statusColor(status: string): string {
  if (status === 'completed') return '#d4845a';
  if (status === 'in-progress') return '#d4845a';
  return '#484f58';
}

function phaseStatusLabel(phase: GsdPhase): string {
  if (phase.completed) return 'Complete';
  const done = phase.plans.filter(p => p.completed).length;
  if (done > 0) return `${done}/${phase.plans.length} plans done`;
  return 'Planned';
}

function phaseColor(phase: GsdPhase, isActive: boolean): string {
  if (phase.completed) return '#d4845a';
  if (isActive) return '#d4845a';
  return '#484f58';
}

export const GsdRoadmap: FC<GsdRoadmapProps> = ({ cwd, onOpenFile, activeFilePath, onSendCommand }) => {
  const [data, setData] = useState<RoadmapResponse | null>(null);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [quickDoneCollapsed, setQuickDoneCollapsed] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<{
    label: string;
    endpoint: string;
    body: Record<string, unknown>;
  } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [addOption, setAddOption] = useState<AddOption | null>(null);
  const [phasesCollapsed, setPhasesCollapsed] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!addMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setAddMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [addMenuOpen]);

  const handleAddSubmit = (text: string) => {
    if (!addOption) return;
    onSendCommand?.(`${addOption.command} ${text}`);
    setAddOption(null);
  };

  const fetchRoadmap = useCallback((silent = false) => {
    if (!silent) setData(null);
    fetch(`/api/gsd-roadmap?cwd=${encodeURIComponent(cwd)}`)
      .then(r => r.json())
      .then(d => {
        setData(d as RoadmapResponse);
        if (d.exists && !initializedRef.current) {
          initializedRef.current = true;
          const rd = d as GsdRoadmapData;
          // Expand only the active phase (first in-progress), collapse everything else
          const activeNum = rd.phases.find(p => !p.completed && p.plans.some((pl: GsdPlan) => pl.completed))?.number
            ?? rd.phases.find(p => !p.completed)?.number;
          setCollapsed(new Set(rd.phases.filter(p => p.number !== activeNum).map(p => p.number)));
        }
      })
      .catch(() => { if (!silent) setData({ exists: false }); });
  }, [cwd]);

  useEffect(() => { fetchRoadmap(); }, [fetchRoadmap]);

  useEffect(() => {
    const id = setInterval(() => fetchRoadmap(true), 3000);
    return () => clearInterval(id);
  }, [fetchRoadmap]);

  // Auto-expand phase containing the active editor file
  useEffect(() => {
    if (!activeFilePath || !data || !('phases' in data)) return;
    const rd = data as GsdRoadmapData;
    const owningPhase = rd.phases.find(phase =>
      phase.plans.some(p => p.planPath === activeFilePath) ||
      phase.researchPath === activeFilePath ||
      phase.verificationPath === activeFilePath
    );
    if (owningPhase) {
      setCollapsed(prev => {
        if (!prev.has(owningPhase.number)) return prev;
        const next = new Set(prev);
        next.delete(owningPhase.number);
        return next;
      });
    }
  }, [activeFilePath, data]);

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleteLoading(true);
    try {
      await fetch(pendingDelete.endpoint, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pendingDelete.body),
      });
      fetchRoadmap(false);
    } catch { /* ignore */ } finally {
      setDeleteLoading(false);
      setPendingDelete(null);
    }
  };

  const toggleCollapse = (num: number) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num); else next.add(num);
      return next;
    });
  };

  const openFile = (filePath: string | null) => {
    if (filePath) onOpenFile(filePath, true);
  };

  if (data === null) {
    return (
      <div className="rm-loading">
        <div className="rm-loading-dots"><span /><span /><span /></div>
      </div>
    );
  }

  if (!data.exists) {
    return (
      <div className="rm-empty">
        <div className="rm-empty-icon"><IconMap /></div>
        <div className="rm-empty-title">No GSD Roadmap found</div>
        <div className="rm-empty-body">
          This panel shows your project's development roadmap when a <code>.planning/</code> directory is present.
        </div>
        <div className="rm-empty-hint">
          To get started, open Claude Code in this folder and run:
          <code className="rm-empty-cmd">/gsd:new-project</code>
        </div>
      </div>
    );
  }

  const rd = data as GsdRoadmapData;
  const { milestone, status, phases, quickTasks, roadmapPath, statePath, projectPath, requirementsPath } = rd;
  const allPlans = phases.flatMap(p => p.plans);
  const actualCompleted = allPlans.filter(p => p.completed).length;
  const actualTotal = allPlans.length;
  const pct = actualTotal > 0 ? Math.round((actualCompleted / actualTotal) * 100) : 0;
  const color = statusColor(status);

  const pendingQuickTasks = quickTasks.filter(t => !t.completed);
  const doneQuickTasks = quickTasks.filter(t => t.completed);

  // Active phase: first in-progress (has some but not all plans done), or first incomplete
  const activePhaseNum = phases.find(p => !p.completed && p.plans.some(pl => pl.completed))?.number
    ?? phases.find(p => !p.completed)?.number;

  return (
    <div className="rm-root">
      {/* ── Header: version + planning docs ── */}
      <div className="rm-header">
        <div className="rm-milestone-row">
          <span className="rm-version-label">
            <span className="rm-version-text">version</span>
            <span className="rm-version-num" style={{ color }}>{(milestone || 'v?').replace(/^v/, '')}</span>
          </span>
          <div className="rm-header-actions" ref={addMenuRef}>
            <button
              className="rm-add-btn"
              onClick={() => setAddMenuOpen(v => !v)}
              title="Add phase, quick task, or milestone"
            >
              <IconPlus />
            </button>
            {addMenuOpen && (
              <div className="rm-add-menu">
                {ADD_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    className="rm-add-menu-item"
                    onClick={() => { setAddOption(opt); setAddMenuOpen(false); }}
                  >
                    <span className="rm-add-menu-label">{opt.label}</span>
                    <span className="rm-add-menu-desc">{opt.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Planning file links */}
        <div className="rm-file-links">
          <div className="rm-file-links-label">Planning Docs</div>
          <button className="rm-file-link-btn" onClick={() => openFile(roadmapPath)}>
            <span className="rm-file-link-icon"><IconFile /></span>ROADMAP.md
          </button>
          {projectPath && (
            <button className="rm-file-link-btn" onClick={() => openFile(projectPath)}>
              <span className="rm-file-link-icon"><IconFile /></span>PROJECT.md
            </button>
          )}
          {requirementsPath && (
            <button className="rm-file-link-btn" onClick={() => openFile(requirementsPath)}>
              <span className="rm-file-link-icon"><IconFile /></span>REQUIREMENTS.md
            </button>
          )}
          <button className="rm-file-link-btn" onClick={() => openFile(statePath)}>
            <span className="rm-file-link-icon"><IconFile /></span>STATE.md
          </button>
        </div>
      </div>

      {/* ── Progress (below header divider) ── */}
      <div className="rm-progress-section">
        <div className="rm-progress-bar-wrap">
          <div className="rm-progress-bar">
            <div className="rm-progress-fill" style={{ width: `${pct}%`, background: color }} />
          </div>
          <span className="rm-progress-pct" style={{ color }}>{pct}%</span>
        </div>
        <div className="rm-progress-stats">
          {actualCompleted}/{actualTotal} plans · {phases.filter(p => p.completed).length}/{phases.length} phases
        </div>
      </div>

      {/* ── Quick Tasks ── */}
      {quickTasks.length > 0 && (
        <div className="rm-quick-section">
          <div className="rm-quick-header">
            <IconBolt />
            <span>Quick Tasks</span>
            <span className="rm-quick-count" style={{ color: pendingQuickTasks.length > 0 ? '#d4845a' : '#484f58' }}>
              {pendingQuickTasks.length > 0 ? `${pendingQuickTasks.length} pending` : 'all done'}
            </span>
          </div>

          {pendingQuickTasks.length > 0 && (
            <div className="rm-quick-list">
              {pendingQuickTasks.map(task => (
                <div
                  key={task.number}
                  className={`rm-quick-item rm-quick-item--pending${task.planPath ? ' rm-quick-item--link' : ''}${task.planPath && activeFilePath === task.planPath ? ' rm-item--active' : ''}`}
                  onClick={() => openFile(task.planPath)}
                  title={task.planPath ? 'Open plan in editor' : undefined}
                >
                  <span className="rm-plan-check" />
                  <span className="rm-quick-num">{task.number}</span>
                  <span className="rm-quick-desc">{task.description}</span>
                  {task.date && <span className="rm-quick-date">{task.date.slice(5)}</span>}
                  <div className="rm-item-actions" onClick={e => {
                    e.stopPropagation();
                    setPendingDelete({ label: `Quick task ${task.number}: ${task.description}`, endpoint: '/api/gsd/quick', body: { cwd, dirName: task.dirName, num: task.number } });
                  }}>
                    <button className="rm-delete-btn" title="Delete quick task"><IconTrashSm /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {doneQuickTasks.length > 0 && (
            <>
              <div className="rm-quick-done-toggle" onClick={() => setQuickDoneCollapsed(v => !v)}>
                <IconChevron open={!quickDoneCollapsed} />
                <span>{doneQuickTasks.length} completed</span>
              </div>
              {!quickDoneCollapsed && (
                <div className="rm-quick-list">
                  {doneQuickTasks.map(task => (
                    <div
                      key={task.number}
                      className={`rm-quick-item${task.planPath ? ' rm-quick-item--link' : ''}${task.planPath && activeFilePath === task.planPath ? ' rm-item--active' : ''}`}
                      onClick={() => openFile(task.planPath)}
                      title={task.planPath ? 'Open plan in editor' : undefined}
                    >
                      <span className="rm-plan-check rm-plan-check--done"><IconCheck /></span>
                      <span className="rm-quick-num">{task.number}</span>
                      <span className="rm-quick-desc">{task.description}</span>
                      {task.date && <span className="rm-quick-date">{task.date.slice(5)}</span>}
                      <div className="rm-item-actions" onClick={e => {
                        e.stopPropagation();
                        setPendingDelete({ label: `Quick task ${task.number}: ${task.description}`, endpoint: '/api/gsd/quick', body: { cwd, dirName: task.dirName, num: task.number } });
                      }}>
                        <button className="rm-delete-btn" title="Delete quick task"><IconTrashSm /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Phases ── */}
      <div className="rm-phases-section">
        <div className="rm-phases-header" onClick={() => setPhasesCollapsed(v => !v)}>
          <IconLayers />
          <span>Phases</span>
          <span className="rm-phases-count">
            {phases.filter(p => p.completed).length}/{phases.length}
          </span>
          <span className="rm-phases-chevron"><IconChevron open={!phasesCollapsed} /></span>
        </div>

        {!phasesCollapsed && (
          <div className="rm-timeline">
            {[...phases].reverse().map((phase, phaseIdx) => {
              const isOpen = !collapsed.has(phase.number);
              const isActive = phase.number === activePhaseNum;
              const pc = phaseColor(phase, isActive);
              const completedPlans = phase.plans.filter(p => p.completed).length;
              const isLast = phaseIdx === phases.length - 1;

              return (
                <div key={phase.number} className={`rm-phase-wrap${isActive ? ' rm-phase-wrap--active' : ''}`}>
                  <div className="rm-phase-row" onClick={() => toggleCollapse(phase.number)}>
                    <div className="rm-phase-track">
                      <div className="rm-phase-dot" style={{ borderColor: pc, background: phase.completed ? pc : isActive ? 'rgba(212,132,90,0.2)' : 'transparent' }}>
                        {phase.completed && <IconCheck />}
                      </div>
                      {!isLast && <div className="rm-phase-line" />}
                    </div>
                    <div className="rm-phase-body">
                      <div className="rm-phase-top">
                        <span className="rm-phase-num" style={{ color: pc }}>Phase {phase.number}</span>
                        {isActive && <span className="rm-active-badge">In progress</span>}
                        <span className="rm-phase-chevron"><IconChevron open={isOpen} /></span>
                      </div>
                      <div className="rm-phase-name" style={{ color: phase.completed && !isActive ? '#484f58' : undefined }}>
                        {phase.name}
                      </div>
                      <div className="rm-phase-meta" style={{ color: pc }}>
                        {phaseStatusLabel(phase)}
                        {phase.plans.length > 0 && ` · ${completedPlans}/${phase.plans.length}`}
                      </div>
                      {isActive && phase.plans.length > 0 && (
                        <div className="rm-phase-mini-bar">
                          <div className="rm-phase-mini-fill" style={{ width: `${Math.round((completedPlans / phase.plans.length) * 100)}%` }} />
                        </div>
                      )}
                    </div>
                    <div className="rm-item-actions" onClick={e => {
                      e.stopPropagation();
                      setPendingDelete({ label: `Phase ${phase.number}: ${phase.name}`, endpoint: '/api/gsd/phase', body: { cwd, phase: phase.number } });
                    }}>
                      <button className="rm-delete-btn" title="Delete phase"><IconTrashSm /></button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="rm-plans-wrap">
                      <div className="rm-plans-track">
                        <div className="rm-plans-line" />
                      </div>
                      <div className="rm-plans-list">
                        {phase.goal && <div className="rm-phase-goal">{phase.goal}</div>}
                        {phase.plans.map(plan => (
                          <div
                            key={plan.id}
                            className={`rm-plan-item${plan.planPath ? ' rm-plan-item--link' : ''}${plan.planPath && activeFilePath === plan.planPath ? ' rm-item--active' : ''}`}
                            onClick={() => openFile(plan.planPath)}
                            title={plan.planPath ? 'Open plan in editor' : undefined}
                          >
                            <span className={`rm-plan-check${plan.completed ? ' rm-plan-check--done' : ''}`}>
                              {plan.completed ? <IconCheck /> : null}
                            </span>
                            <span className="rm-plan-id">{plan.id}</span>
                            <span className="rm-plan-name">{plan.name}</span>
                            <div className="rm-item-actions" onClick={e => {
                              e.stopPropagation();
                              setPendingDelete({ label: `Plan ${plan.id}`, endpoint: '/api/gsd/plan', body: { cwd, phaseNum: phase.number, planId: plan.id } });
                            }}>
                              <button className="rm-delete-btn" title="Delete plan"><IconTrashSm /></button>
                            </div>
                          </div>
                        ))}
                        {(phase.researchPath || phase.verificationPath) && (
                          <div className="rm-phase-docs">
                            {phase.researchPath && (
                              <button className={`rm-doc-link${activeFilePath === phase.researchPath ? ' rm-item--active' : ''}`} onClick={() => openFile(phase.researchPath)}>Research</button>
                            )}
                            {phase.verificationPath && (
                              <button className={`rm-doc-link${activeFilePath === phase.verificationPath ? ' rm-item--active' : ''}`} onClick={() => openFile(phase.verificationPath)}>Verification</button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {pendingDelete && (
        <ConfirmModal
          title="Delete permanently"
          message={`"${pendingDelete.label}" will be permanently removed. This cannot be undone.`}
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDelete(null)}
          loading={deleteLoading}
        />
      )}

      {addOption && (
        <GsdAddModal
          option={addOption}
          onSubmit={handleAddSubmit}
          onCancel={() => setAddOption(null)}
        />
      )}
    </div>
  );
};
