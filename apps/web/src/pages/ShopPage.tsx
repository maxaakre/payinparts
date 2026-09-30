import { formatKr, type Product } from '@payinparts/core';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../api';
import { useI18n } from '../i18n';

export function ShopPage() {
  const { t, lang } = useI18n();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api.products().then((r) => setProducts(r.products)).catch(() => setFailed(true));
  }, []);

  if (failed) return <p className="error" role="alert">{t('errorGeneric')}</p>;
  if (!products) return <p>{t('loading')}</p>;

  return (
    <section>
      <h1>{t('shopTitle')}</h1>
      <ul className="grid">
        {products.map((p) => (
          <li key={p.id} className="card product">
            <span className="emoji" aria-hidden="true">{p.emoji}</span>
            <h2>{p.name[lang]}</h2>
            <p className="price">{formatKr(p.priceOre, lang)}</p>
            <Link className="button" to={`/checkout/${p.id}`}>
              {t('choose')}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
