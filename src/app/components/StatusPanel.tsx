import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useColor} from '@/utils/color/color';

const StatusPanel = ({
  actionLabel,
  message,
  onAction,
  retryLabel,
}: {
  actionLabel?: string;
  message?: string;
  onAction?: () => void;
  retryLabel: string;
}): React.JSX.Element => {
  const color = useColor();
  const {t} = useTranslation();
  return (
    <View style={styles.container}>
      {message ? (
        <Text style={[styles.message, {color: color.ham_text_secondary}]}>
          {message}
        </Text>
      ) : (
        <ActivityIndicator color={color.ham_blue} size="large" />
      )}
      {onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({pressed}) => [
            styles.action,
            {
              backgroundColor: color.ham_lightBlue,
              opacity: pressed ? 0.7 : 1,
            },
          ]}>
          <Text style={[styles.actionLabel, {color: color.ham_blue}]}>
            {actionLabel ?? retryLabel}
          </Text>
        </Pressable>
      ) : null}
      {!message ? (
        <Text style={[styles.loading, {color: color.ham_text_secondary}]}>
          {t('app.loading')}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  action: {
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  container: {
    alignItems: 'center',
    flex: 1,
    gap: 16,
    justifyContent: 'center',
    padding: 24,
  },
  loading: {
    fontSize: 14,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});

export default StatusPanel;
