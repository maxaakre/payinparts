import { useState } from 'react';
import { api, ApiRequestError } from '../api';
import { useI18n } from '../i18n';

export function ExplainPanel({ orderId }: { orderId: string }) {
  const { t, lang } = useI18n();
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<{ q: string; a: string }[]>([]);
  const [questionsLeft, setQuestionsLeft] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(q: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await api.explain(orderId, { question: q, language: lang });
      setHistory((prev) => [...prev, { q, a: res.answer }]);
      setQuestionsLeft(res.questionsLeft);
      setQuestion('');
    } catch (err) {
      const code = err instanceof ApiRequestError ? err.code : '';
      setError(code === 'RATE_LIMITED' ? t('aiLimit') : code === 'AI_UNAVAILABLE' ? t('aiUnavailable') : t('errorGeneric'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="card explain">
      <h2>✨ {t('explainTitle')}</h2>
      {history.length === 0 && (
        <button className="secondary" disabled={busy} onClick={() => ask(t('explainDefaultQuestion'))}>
          {busy ? t('thinking') : t('explainStart')}
        </button>
      )}
      {history.map((item, i) => (
        <div key={i} className="qa">
          <p className="q">{item.q}</p>
          <p className="a">{item.a}</p>
        </div>
      ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const q = question.trim();
          if (q) void ask(q);
        }}
      >
        <input
          value={question}
          maxLength={500}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={t('explainPlaceholder')}
          aria-label={t('explainPlaceholder')}
        />
        <button type="submit" disabled={busy || !question.trim()}>
          {busy ? t('thinking') : t('ask')}
        </button>
      </form>
      {questionsLeft !== null && <p className="muted small">{t('questionsLeft', { count: questionsLeft })}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <p className="muted small">{t('aiDisclaimer')}</p>
    </aside>
  );
}
