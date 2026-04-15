import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CreatePromptDialog, CreatePromptVersionDialog } from './prompt-actions';

const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

describe('prompt action dialogs', () => {
  beforeEach(() => {
    refresh.mockReset();
  });

  it('renders create prompt dialog fields after opening', () => {
    render(<CreatePromptDialog createPromptAction={vi.fn().mockResolvedValue({ ok: true })} />);

    fireEvent.click(screen.getByRole('button', { name: /Create prompt/i }));

    expect(screen.getByLabelText(/Prompt name/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Create prompt$/i })).toBeInTheDocument();
  });

  it('renders create prompt version dialog fields after opening', () => {
    render(<CreatePromptVersionDialog createPromptVersionAction={vi.fn().mockResolvedValue({ ok: true })} />);

    fireEvent.click(screen.getByRole('button', { name: /Create version/i }));

    expect(screen.getByLabelText(/Prompt content/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Model/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Create version$/i })).toBeInTheDocument();
  });
});
