import { Modal, StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';

export interface TipItem {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}

interface TipsModalProps {
  visible: boolean;
  title: string;
  tips: TipItem[];
  onClose: () => void;
}

export default function TipsModal({ visible, title, tips, onClose }: TipsModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Gradient header */}
          <LinearGradient
            colors={[Colors.gradientStart, Colors.gradientEnd]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <Ionicons name="help-circle" size={24} color="white" />
            <Text style={styles.title}>{title}</Text>
          </LinearGradient>

          {/* Tips list */}
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {tips.map((tip, i) => (
              <View key={i} style={styles.tipRow}>
                <View style={styles.tipIcon}>
                  <Ionicons name={tip.icon} size={18} color={Colors.primary} />
                </View>
                <Text style={styles.tipText}>{tip.text}</Text>
              </View>
            ))}
          </ScrollView>

          {/* Close button */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.closeText}>Anladım</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
    padding: Spacing.xl,
  },
  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    width: '100%', maxWidth: 360, maxHeight: '80%',
    overflow: 'hidden', ...Shadows.lg,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.lg, paddingHorizontal: Spacing.lg,
  },
  title: {
    fontFamily: Typography.fontDisplayBold, fontSize: Typography.size.lg, color: '#FFFFFF',
  },
  body: { maxHeight: 320 },
  bodyContent: { padding: Spacing.lg, gap: Spacing.md },
  tipRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md,
    backgroundColor: Colors.background, borderRadius: Radius.md,
    padding: Spacing.md,
  },
  tipIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.primary + '12',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1,
  },
  tipText: {
    flex: 1, fontFamily: Typography.fontBody, fontSize: Typography.size.sm,
    color: Colors.textSecondary, lineHeight: Typography.size.sm * 1.5,
  },
  closeBtn: {
    margin: Spacing.lg, marginTop: 0,
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingVertical: Spacing.md, alignItems: 'center',
  },
  closeText: {
    fontFamily: Typography.fontBodyBold, fontSize: Typography.size.md, color: '#FFFFFF',
  },
});
