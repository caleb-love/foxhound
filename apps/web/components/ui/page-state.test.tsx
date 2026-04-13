import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageErrorState, PageWarningState } from './page-state';

describe('PageState components', () => {
  it('renders reusable error state content', () => {
    render(
      <PageErrorState
        title="Unable to load traces"
        message="Something went wrong"
        detail="Try again in a moment"
      />,
    );

    expect(screen.getByText('Unable to load traces')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Try again in a moment')).toBeInTheDocument();
  });

  it('renders reusable warning state content', () => {
    render(
      <PageWarningState
        title="Select two traces"
        message="Choose two runs to compare"
      />,
    );

    expect(screen.getByText('Select two traces')).toBeInTheDocument();
    expect(screen.getByText('Choose two runs to compare')).toBeInTheDocument();
  });
});
