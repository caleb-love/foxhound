import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SetPromptLabelDialog } from './prompt-label-actions';

const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

describe('SetPromptLabelDialog', () => {
  beforeEach(() => {
    refresh.mockReset();
  });

  it('renders prompt label controls after opening', () => {
    render(
      <SetPromptLabelDialog
        availableVersions={[3, 2, 1]}
        setPromptLabelAction={vi.fn().mockResolvedValue({ ok: true })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Set label/i }));

    expect(screen.getByLabelText('Label')).toBeInTheDocument();
    expect(screen.getByLabelText('Version')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Set label$/i })).toBeInTheDocument();
  });
});
