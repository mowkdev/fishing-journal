import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@/app/providers/ThemeProvider.jsx';
import { UnderConstructionPage } from './UnderConstructionPage.jsx';

describe('UnderConstructionPage', () => {
  it('renders the title and under-construction message', () => {
    render(
      <ThemeProvider defaultTheme="light" storageKey="test-theme">
        <UnderConstructionPage />
      </ThemeProvider>,
    );

    expect(screen.getByRole('heading', { name: /fishing journal/i })).toBeInTheDocument();
    expect(screen.getByText(/under construction/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /switch to (light|dark) theme/i })).toBeInTheDocument();
  });
});
