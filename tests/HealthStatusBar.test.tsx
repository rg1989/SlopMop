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

    const { container } = render(<HealthStatusBar health={mockHealth} />);

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

    const { container } = render(<HealthStatusBar health={loadingHealth} />);

    expect(container.querySelector('.health-dot--loading')).not.toBeNull();
  });
});
