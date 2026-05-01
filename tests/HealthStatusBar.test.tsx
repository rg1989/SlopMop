import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { HealthStatusBar } from '../client/components/HealthStatusBar';
import type { ProjectHealth } from '../client/hooks/useProjectHealth';

describe('HealthStatusBar', () => {
  it('HEALTH-03 — renders correct dot classes per health state', () => {
    const mockHealth: ProjectHealth = {
      loading: false,
      dirAccessible: true,
      isGitRepo: false,
      hasClaudeMd: false,
      agentFound: true,
      agentPath: '/usr/bin/claude',
      hasNodeModules: null,
    };

    const { container } = render(<HealthStatusBar health={mockHealth} slopExists={null} />);

    expect(container.querySelector('.health-dot--warn')).not.toBeNull();
    expect(container.querySelector('.health-dot--ok')).not.toBeNull();
  });

  it('HEALTH-03b — dots have loading class when loading=true', () => {
    const loadingHealth: ProjectHealth = {
      loading: true,
      dirAccessible: false,
      isGitRepo: false,
      hasClaudeMd: false,
      agentFound: false,
      agentPath: null,
      hasNodeModules: null,
    };

    const { container } = render(<HealthStatusBar health={loadingHealth} slopExists={null} />);

    expect(container.querySelector('.health-dot--loading')).not.toBeNull();
  });
});

describe('Phase 6 — slop dot', () => {
  const baseHealth: ProjectHealth = {
    loading: false,
    dirAccessible: true,
    isGitRepo: false,
    hasClaudeMd: false,
    agentFound: true,
    agentPath: '/usr/bin/claude',
    hasNodeModules: null,
  };

  it('slopExists=false renders a warn dot with title containing "missing"', () => {
    const { container } = render(<HealthStatusBar health={baseHealth} slopExists={false} />);
    const dots = container.querySelectorAll('.health-dot--warn');
    const slopDot = Array.from(dots).find(d => d.getAttribute('title')?.includes('missing'));
    expect(slopDot).not.toBeNull();
  });

  it('slopExists=true renders an ok dot with title containing "present"', () => {
    const allGreenHealth: ProjectHealth = {
      loading: false,
      dirAccessible: true,
      isGitRepo: true,
      hasClaudeMd: true,
      agentFound: true,
      agentPath: '/usr/bin/claude',
      hasNodeModules: null,
    };
    const { container } = render(<HealthStatusBar health={allGreenHealth} slopExists={false} />);
    const warnDot = container.querySelector('.health-dot--warn');
    expect(warnDot?.getAttribute('title')).toContain('missing');
  });

  it('slopExists=null renders no slop dot (dot count stays at 5 or less)', () => {
    const { container } = render(<HealthStatusBar health={baseHealth} slopExists={null} />);
    const allDots = container.querySelectorAll('.health-dot');
    expect(allDots.length).toBeLessThanOrEqual(5);
    const slopDot = Array.from(allDots).find(d =>
      d.getAttribute('title')?.toLowerCase().includes('slop')
    );
    expect(slopDot).toBeUndefined();
  });

  it('slopExists=true renders ok dot with title containing "present"', () => {
    const { container } = render(<HealthStatusBar health={baseHealth} slopExists={true} />);
    const allDots = container.querySelectorAll('.health-dot');
    const slopDot = Array.from(allDots).find(d =>
      d.getAttribute('title')?.toLowerCase().includes('present')
    );
    expect(slopDot).not.toBeNull();
    expect(slopDot?.className).toContain('health-dot--ok');
  });

  it('all green + slopExists=true still returns null (allGreen logic)', () => {
    const allGreenHealth: ProjectHealth = {
      loading: false,
      dirAccessible: true,
      isGitRepo: true,
      hasClaudeMd: true,
      agentFound: true,
      agentPath: '/usr/bin/claude',
      hasNodeModules: null,
    };
    const { container } = render(<HealthStatusBar health={allGreenHealth} slopExists={true} />);
    expect(container.firstChild).toBeNull();
  });
});
