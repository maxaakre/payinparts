import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n';
import { CreditCheckForm } from './CreditCheckForm';

const setup = (onChange = vi.fn()) => {
  render(
    <I18nProvider initial="en">
      <CreditCheckForm disabled={false} onSubmit={vi.fn()} onChange={onChange} />
    </I18nProvider>,
  );
  return onChange;
};

describe('CreditCheckForm', () => {
  it('calls onChange when the persona changes', () => {
    const onChange = setup();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'erik' } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('calls onChange when the income changes', () => {
    const onChange = setup();
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '31000' } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
