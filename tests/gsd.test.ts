import { describe, it, expect } from 'vitest';
import { parseRoadmapMd } from '../server/gsd.js';

const ROADMAP_WITH_OVERVIEW = `# Roadmap

## Phases

- [x] **Phase 1: PTY Core** - Node backend
- [ ] **Phase 2: File System** - Files

## Phase Details

### Phase 1: PTY Core
**Goal**: User can open Claude CLI in a real terminal
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md — Scaffold
- [x] 01-02-PLAN.md — Terminal component

### Phase 2: File System
**Goal**: File explorer and attachments
**Plans**: 1 plan

Plans:
- [ ] 02-01-PLAN.md — Wave 0 stubs
`;

const ROADMAP_DETAIL_ONLY = `# Roadmap

## Overview

Some intro text.

## Phase Details

### Phase 3: Voice I/O
**Goal**: Voice transcription and TTS

Plans:
- [ ] 03-01-PLAN.md — Wave 0 stubs
- [ ] 03-02-PLAN.md — Whisper integration
`;

describe('parseRoadmapMd', () => {
  it('phase with no ## Phases list entry is still parsed when it has a ### Phase N: section', () => {
    const phases = parseRoadmapMd(ROADMAP_DETAIL_ONLY);
    expect(phases.length).toBeGreaterThanOrEqual(1);
    const phase3 = phases.find(p => p.number === 3);
    expect(phase3).toBeDefined();
    expect(phase3!.name).toBe('Voice I/O');
  });

  it('goal from **Goal**: line is captured', () => {
    const phases = parseRoadmapMd(ROADMAP_WITH_OVERVIEW);
    const phase1 = phases.find(p => p.number === 1);
    expect(phase1!.goal).toBe('User can open Claude CLI in a real terminal');
  });

  it('completed state comes from ## Phases checkbox (- [x]) not from ### Phase N: presence', () => {
    const phases = parseRoadmapMd(ROADMAP_WITH_OVERVIEW);
    const phase1 = phases.find(p => p.number === 1);
    const phase2 = phases.find(p => p.number === 2);
    expect(phase1!.completed).toBe(true);
    expect(phase2!.completed).toBe(false);
  });

  it('plans list from Plans: block is parsed correctly', () => {
    const phases = parseRoadmapMd(ROADMAP_WITH_OVERVIEW);
    const phase1 = phases.find(p => p.number === 1);
    expect(phase1!.plans).toHaveLength(2);
    expect(phase1!.plans[0]).toMatchObject({ file: '01-01-PLAN.md', name: 'Scaffold', completed: true });
    expect(phase1!.plans[1]).toMatchObject({ file: '01-02-PLAN.md', name: 'Terminal component', completed: true });
  });

  it('phases returned sorted by number ascending', () => {
    const phases = parseRoadmapMd(ROADMAP_WITH_OVERVIEW);
    for (let i = 1; i < phases.length; i++) {
      expect(phases[i].number).toBeGreaterThan(phases[i - 1].number);
    }
  });

  it('existing ROADMAP.md structure (phases IN the ## Phases list) still parses correctly', () => {
    const phases = parseRoadmapMd(ROADMAP_WITH_OVERVIEW);
    expect(phases.length).toBe(2);
    const phase1 = phases.find(p => p.number === 1);
    const phase2 = phases.find(p => p.number === 2);
    expect(phase1).toBeDefined();
    expect(phase2).toBeDefined();
    expect(phase1!.name).toBe('PTY Core');
    expect(phase2!.name).toBe('File System');
  });
});
