import { StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getAvatarGradient, AVATAR_GRADIENT_ANGLE } from '@/constants/avatarColors';
import { Colors, Typography, Radius } from '@/constants/theme';

/**
 * Kullanıcının seçtiği base renkten gradient avatar üretir.
 * Fallback: düz renk (base hex gradient haritasında yoksa).
 * Ghost üyeler için ghostColor ile muted görünüm.
 * Emoji varsa harf yerine emoji gösterir (grup avatarları için).
 */
interface AvatarProps {
  initials: string;
  color?: string | null;        // base hex (profiles.avatar_color / groups.avatar_color)
  ghostColor?: string;          // ghost üyeler için düz renk
  emoji?: string | null;        // grup avatarları için emoji (harf yerine)
  size?: number;
}

export default function Avatar({ initials, color, ghostColor, emoji, size = 44 }: AvatarProps) {
  // Ghost üye: düz renk, gradient yok
  if (ghostColor) {
    return (
      <LinearGradient
        colors={[ghostColor, ghostColor]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
      >
        <Text style={[styles.text, { fontFamily: Typography.fontDisplay, fontSize: size * 0.38 }]}>{initials}</Text>
      </LinearGradient>
    );
  }

  // Gerçek kullanıcı / grup: gradient (veya fallback düz)
  const gradient = color ? getAvatarGradient(color) : [Colors.primary, Colors.primaryLight];
  const angleRad = (AVATAR_GRADIENT_ANGLE * Math.PI) / 180;
  const start = { x: 0, y: 0 };
  const end = { x: Math.cos(angleRad), y: Math.sin(angleRad) };

  return (
    <LinearGradient
      colors={[gradient[0], gradient[1]]}
      start={start} end={end}
      style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Text
        style={[
          styles.text,
          emoji
            ? { fontSize: size * 0.52 }
            : { fontFamily: Typography.fontDisplay, fontSize: size * 0.38 },
        ]}
        adjustsFontSizeToFit
        numberOfLines={1}
      >
        {emoji ?? initials}
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
