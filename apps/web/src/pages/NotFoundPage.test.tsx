import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { I18nProvider } from '../i18n';
import { NotFoundPage } from '../pages/NotFoundPage';

describe('NotFoundPage', () => {
  it('shows a friendly message and a way back', () => {
    render(
      <I18nProvider initial="en">
        <MemoryRouter>
          <NotFoundPage />
        </MemoryRouter>
      </I18nProvider>,
    );
    expect(screen.getByText('We could not find that page.')).toBeTruthy();
    expect(screen.getByRole('link').getAttribute('href')).toBe('/');
  });
});
