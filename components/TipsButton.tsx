import { useState } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TipsModal, { type TipItem } from './TipsModal';
import { Colors } from '@/constants/theme';

interface TipsButtonProps {
  title: string;
  tips: TipItem[];
}

/**
 * "?" button that opens a TipsModal with page-specific help content.
 * Place it in headerRight or anywhere you need contextual help.
 */
export default function TipsButton({ title, tips }: TipsButtonProps) {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <TouchableOpacity
        style={styles.button}
        onPress={() => setVisible(true)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="help-circle-outline" size={22} color={Colors.primary} />
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
