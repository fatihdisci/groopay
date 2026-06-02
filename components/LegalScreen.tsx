import { StyleSheet, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Colors, Typography, Spacing } from '@/constants/theme';

export interface LegalSection {
  heading?: string;
  body: string;
}

interface LegalScreenProps {
  title: string;
  lastUpdated: string;
  content: LegalSection[];
}

export default function LegalScreen({ title, lastUpdated, content }: LegalScreenProps) {
  const { t } = useTranslation();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.lastUpdated}>{t('legal.lastUpdatedLabel', { date: lastUpdated })}</Text>

      {content.map((section, index) => (
        <View key={`${section.heading ?? 'section'}-${index}`}>
          {index > 0 ? <View style={styles.separator} /> : null}
          {section.heading ? <Text style={styles.heading}>{section.heading}</Text> : null}
          <Text style={styles.body}>{section.body}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 48 },
  title: {
    fontFamily: Typography.fontDisplayBold,
    fontSize: 24,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  lastUpdated: {
    fontFamily: Typography.fontBody,
    fontSize: 12,
    color: Colors.textTertiary,
    marginBottom: 24,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginTop: Spacing.lg,
  },
  heading: {
    fontFamily: Typography.fontBodyBold,
    fontSize: 15,
    color: Colors.textPrimary,
    marginTop: 20,
    marginBottom: 6,
  },
  body: {
    fontFamily: Typography.fontBody,
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
});
