import { useTranslation } from 'react-i18next';

import LegalScreen, { LegalSection } from '@/components/LegalScreen';

function isLegalSection(value: unknown): value is LegalSection {
  if (!value || typeof value !== 'object') return false;
  const section = value as { heading?: unknown; body?: unknown };
  return (
    typeof section.body === 'string' &&
    (section.heading === undefined || typeof section.heading === 'string')
  );
}

function readLegalSections(value: unknown): LegalSection[] {
  return Array.isArray(value) ? value.filter(isLegalSection) : [];
}

export default function PrivacyScreen() {
  const { t } = useTranslation();
  const sections = readLegalSections(t('legal.privacy.sections', { returnObjects: true }) as unknown);

  return (
    <LegalScreen
      title={t('legal.privacy.title')}
      lastUpdated={t('legal.privacy.lastUpdated')}
      content={sections}
    />
  );
}
