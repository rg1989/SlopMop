import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

// @ts-expect-error — module does not exist yet (Wave 0 RED)
import { HealthStatusBar } from '../client/components/HealthStatusBar';

describe('HealthStatusBar', () => {
  it('HEALTH-03 — renders correct dot classes per health state', () => {
    const mockHealth = {
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
    const loadingHealth = {
      loading: true,
      dirAccessible: null,
      isGitRepo: null,
      hasClaudeMd: null,
      agentFound: null,
      agentPath: null,
      hasNodeModules: null,
    };

    const { container } = render(<HealthStatusBar health={loadingHealth} />);

    expect(container.querySelector('.health-dot--loading')).not.toBeNull();
  });
});
