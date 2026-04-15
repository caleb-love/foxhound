import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SandboxBanner } from './sandbox-banner';

describe('SandboxBanner', () => {
  it('renders a visible sandbox warning and user identity', () => {
    render(<SandboxBanner userName="Sandbox Operator" />);

    expect(screen.getByText(/Sandbox enabled/i)).toBeInTheDocument();
    expect(screen.getByText(/Signed in as Sandbox Operator/)).toBeInTheDocument();
  });
});
