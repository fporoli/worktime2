import { useEffect } from 'react';
import { useAuth } from 'react-oidc-context';
import { useTranslation } from 'react-i18next';
import { useMe } from '../api/useMe';

export function LocaleSync() {
  const auth = useAuth();
  const { data: me } = useMe(auth.isAuthenticated);
  const { i18n } = useTranslation();

  useEffect(() => {
    if (me?.locale && me.locale !== i18n.language) {
      void i18n.changeLanguage(me.locale);
    }
  }, [me?.locale, i18n]);

  return null;
}
