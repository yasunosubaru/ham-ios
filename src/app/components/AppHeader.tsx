import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useColor} from '@/utils/color/color';

const AppHeader = ({
  onBack,
  title,
}: {
  onBack: () => void;
  title: string;
}): React.JSX.Element => {
  const color = useColor();
  const {t} = useTranslation();
  return (
    <View
      style={[
        styles.container,
        {backgroundColor: color.ham_bg_b1, borderColor: color.ham_divider},
      ]}>
      <Pressable
        accessibilityLabel="back-button"
        accessibilityRole="button"
        hitSlop={12}
        onPress={onBack}
        testID="back-button"
        style={({pressed}) => [
          styles.backButton,
          {opacity: pressed ? 0.5 : 1},
        ]}>
        <Text style={[styles.backLabel, {color: color.ham_blue}]}>
          {t('app.back')}
        </Text>
      </Pressable>
      <Text
        numberOfLines={1}
        style={[styles.title, {color: color.ham_text_primary}]}>
        {title}
      </Text>
      <View style={styles.trailingSpace} />
    </View>
  );
};

const styles = StyleSheet.create({
  backButton: {
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 52,
  },
  backLabel: {
    fontSize: 17,
  },
  container: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 52,
    paddingHorizontal: 8,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  trailingSpace: {
    minWidth: 52,
  },
});

export default AppHeader;
