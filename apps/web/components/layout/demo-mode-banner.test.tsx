import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DemoModeBanner } from './demo-mode-banner';

describe('DemoModeBanner', () => {
  it('renders a visible demo-mode warning and user identity', () => {
    render(<DemoModeBanner userName="Demo Operator" />);

    expect(screen.getByText(/Demo mode enabled/i)).toBeInTheDocument();
    expect(screen.getByText(/Signed in as Demo Operator/)).toBeInTheDocument();
  });
});
