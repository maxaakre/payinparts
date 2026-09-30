import { findPersona, PERSONAS, type CreditCheckInput } from '@payinparts/core';
import { useState } from 'react';
import { useI18n } from '../i18n';

const firstPersona = PERSONAS[0]!;

export function CreditCheckForm({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (input: CreditCheckInput) => void;
}) {
  const { t } = useI18n();
  const [personaId, setPersonaId] = useState(firstPersona.id);
  const [income, setIncome] = useState(String(firstPersona.defaultMonthlyIncomeKr));

  const incomeKr = Number(income);
  const valid = income.trim() !== '' && Number.isInteger(incomeKr) && incomeKr >= 0 && incomeKr <= 200_000;

  function pickPersona(id: string) {
    setPersonaId(id);
    const persona = findPersona(id);
    if (persona) setIncome(String(persona.defaultMonthlyIncomeKr));
  }

  return (
    <form
      className="card"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSubmit({ personaId, monthlyIncomeKr: incomeKr });
      }}
    >
      <h2>{t('creditTitle')}</h2>
      <p className="muted">{t('creditHelp')}</p>
      <label>
        {t('persona')}
        <select value={personaId} onChange={(e) => pickPersona(e.target.value)}>
          {PERSONAS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.alwaysDecline ? ` (${t('alwaysDeclined')})` : ''}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t('income')}
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={200000}
          step={1}
          value={income}
          onChange={(e) => setIncome(e.target.value)}
          aria-invalid={!valid}
        />
      </label>
      {!valid && <p className="error">{t('incomeInvalid')}</p>}
      <button type="submit" disabled={disabled || !valid}>
        {t('runCheck')}
      </button>
    </form>
  );
}
