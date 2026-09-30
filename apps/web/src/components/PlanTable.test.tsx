import { calculatePlan, formatKr, kr } from '@payinparts/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { I18nProvider } from '../i18n';
import { PlanTable } from './PlanTable';

const renderPlan = (plan: ReturnType<typeof calculatePlan>) =>
  render(
    <I18nProvider initial="en">
      <PlanTable plan={plan} />
    </I18nProvider>,
  );

describe('PlanTable', () => {
  it('always shows the total cost next to the monthly cost', () => {
    const plan = calculatePlan(kr(14990), 'split_12');
    renderPlan(plan);
    const total = screen.getByText('Total cost').closest('tr')!;
    expect(total.textContent).toContain(formatKr(plan.totalCostOre, 'en'));
    const monthly = screen.getByText('Monthly cost').closest('tr')!;
    expect(monthly.textContent).toContain(formatKr(plan.monthlyCostOre, 'en'));
    expect(monthly.nextElementSibling).toBe(total);
    expect(screen.getByText('Effective annual rate')).toBeTruthy();
  });

  it('shows only the amount for pay now', () => {
    renderPlan(calculatePlan(kr(2490), 'pay_now'));
    expect(screen.getByText('You pay today')).toBeTruthy();
    expect(screen.queryByText('Monthly cost')).toBeNull();
  });
});
