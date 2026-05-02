import React, { useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../ThemeContext';
import { spacing, fontSize, borderRadius, ThemeColors } from '../theme';
import { XIcon } from './Icons';

interface VideoModalProps {
  visible: boolean;
  videoUrl: string;
  onClose: () => void;
}

// Pull a YouTube video ID out of common URL shapes:
//   https://www.youtube.com/watch?v=ID
//   https://youtu.be/ID
//   https://www.youtube.com/embed/ID
//   https://youtube.com/shorts/ID
export function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      return u.pathname.slice(1).split('/')[0] || null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (u.pathname === '/watch') return u.searchParams.get('v');
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts[0] === 'embed' || parts[0] === 'shorts') return parts[1] || null;
    }
    return null;
  } catch {
    return null;
  }
}

export default function VideoModal({ visible, videoUrl, onClose }: VideoModalProps) {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const ytId = videoUrl ? extractYouTubeId(videoUrl) : null;

  // Non-YouTube URL → fall back to the system browser instead of embedding.
  useEffect(() => {
    if (visible && videoUrl && !ytId) {
      Linking.openURL(videoUrl).catch(() => {});
      onClose();
    }
  }, [visible, videoUrl, ytId, onClose]);

  if (visible && !ytId) return null;

  const embedUrl = ytId
    ? `https://www.youtube.com/embed/${ytId}?playsinline=1&rel=0`
    : '';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      transparent={Platform.OS === 'ios'}
    >
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={s.header}>
            <TouchableOpacity onPress={onClose} style={s.closeButton}>
              <XIcon size={20} color={colors.text} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
          <View style={s.playerContainer}>
            {embedUrl ? (
              <WebView
                source={{ uri: embedUrl }}
                allowsFullscreenVideo
                javaScriptEnabled
                domStorageEnabled
                mediaPlaybackRequiresUserAction={false}
                startInLoadingState
                renderLoading={() => (
                  <View style={s.loading}>
                    <ActivityIndicator color={colors.primary} />
                  </View>
                )}
              />
            ) : (
              <Text style={s.errorText}>Couldn't load video.</Text>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: borderRadius.lg,
      borderTopRightRadius: borderRadius.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.lg,
      maxHeight: '85%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
    },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.full,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    playerContainer: {
      width: '100%',
      aspectRatio: 16 / 9,
      backgroundColor: '#000',
    },
    loading: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    errorText: {
      color: colors.text,
      fontSize: fontSize.md,
      padding: spacing.md,
      textAlign: 'center',
    },
  });
}
