import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DemoModeBanner } from './demo-mode-banner';

describe('DemoModeBanner', () => {
  it('renders a visible sandbox warning and user identity', () => {
    render(<DemoModeBanner userName="Demo Operator" />);

    expect(screen.getByText(/Sandbox enabled/i)).toBeInTheDocument();
    expect(screen.getByText(/Signed in as Demo Operator/)).toBeInTheDocument();
  });
});
