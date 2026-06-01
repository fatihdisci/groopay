import { useState } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TipsModal, { type TipItem } from './TipsModal';
import { Colors } from '@/constants/theme';

interface TipsButtonProps {
  title: string;
  tips: TipItem[];
  color?: string;
}

/**
 * "?" button that opens a TipsModal with page-specific help content.
 * Place it in headerRight or anywhere you need contextual help.
 */
export default function TipsButton({ title, tips, color }: TipsButtonProps) {
  const [visible, setVisible] = useState(false);
  const iconColor = color ?? Colors.primary;

  return (
    <>
      <TouchableOpacity
        style={styles.button}
        onPress={() => setVisible(true)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="help-circle-outline" size={24} color={iconColor} />
      </TouchableOpacity>

      <TipsModal
        visible={visible}
        title={title}
        tips={tips}
        onClose={() => setVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  button: { padding: 4 },
});
