import { kr, RULES_VERSION, type StoredDecision } from '@payinparts/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n';
import { DecisionMessage } from './DecisionMessage';

const decision = (overrides: Partial<StoredDecision>): StoredDecision => ({
  status: 'approved',
  limitOre: kr(11000),
  maxMonthlyCostOre: kr(2200),
  alternatives: [],
  rulesVersion: RULES_VERSION,
  personaId: 'erik',
  monthlyIncomeOre: kr(22000),
  decidedAt: '2026-10-01T10:00:00.000Z',
  ...overrides,
});

const renderMsg = (d: StoredDecision, onSwitch = vi.fn()) => {
  render(
    <I18nProvider initial="en">
      <DecisionMessage decision={d} onSwitch={onSwitch} />
    </I18nProvider>,
  );
  return onSwitch;
};

describe('DecisionMessage', () => {
  it('offers alternatives that would be approved', () => {
    const onSwitch = renderMsg(decision({ status: 'approved_lower_limit', alternatives: ['split_6', 'split_12'] }));
    fireEvent.click(screen.getByRole('button', { name: 'Switch to: Split into 6 months' }));
    expect(onSwitch).toHaveBeenCalledWith('split_6');
  });

  it('shows the max amount when no plan fits', () => {
    renderMsg(decision({ status: 'approved_lower_limit', alternatives: [] }));
    expect(screen.getByText(/You can buy for up to/)).toBeTruthy();
  });

  it('declines calmly and offers pay now', () => {
    const onSwitch = renderMsg(decision({ status: 'declined' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pay now instead' }));
    expect(onSwitch).toHaveBeenCalledWith('pay_now');
  });
});
