import React, {useEffect, useState} from 'react';
import {
  Alert,
  Appearance,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import {useColor} from '@/utils/color/color';
import CourseScreen from '@/app/CourseScreen';
import GpaCalculatorScreen from '@/app/GpaCalculatorScreen';
import ScoreScreen from '@/app/ScoreScreen';
import WeatherScreen from '@/app/WeatherScreen';
import CasModule from '@/modules/NativeCasModule';
import NativeCommonModule from '@/modules/NativeCommonModule';

type AppRoute = 'home' | 'courses' | 'scores' | 'calculator' | 'weather';

interface HamAppProps {
  appVersion?: string;
  buildNumber?: string;
}

interface FeatureCardProps {
  description: string;
  onPress: () => void;
  testID: string;
  title: string;
}

const FeatureCard = ({
  description,
  onPress,
  testID,
  title,
}: FeatureCardProps): React.JSX.Element => {
  const color = useColor();
  return (
    <Pressable
      accessibilityLabel={testID}
      accessibilityRole="button"
      onPress={onPress}
      testID={testID}
      style={({pressed}) => [
        styles.featureCard,
        {
          backgroundColor: color.ham_bg_b2,
          borderColor: color.ham_divider,
          opacity: pressed ? 0.72 : 1,
        },
      ]}>
      <Text style={[styles.featureTitle, {color: color.ham_text_primary}]}>
        {title}
      </Text>
      <Text
        style={[styles.featureDescription, {color: color.ham_text_secondary}]}>
        {description}
      </Text>
    </Pressable>
  );
};

const HomeScreen = ({
  appVersion,
  buildNumber,
  onOpen,
}: {
  appVersion?: string;
  buildNumber?: string;
  onOpen: (route: AppRoute) => void;
}): React.JSX.Element => {
  const color = useColor();
  const {t, i18n: activeI18n} = useTranslation();
  const features: Array<{
    description: string;
    route: AppRoute;
    testID: string;
    title: string;
  }> = [
    {
      // First because it is the one card that works before anyone logs in:
      // the endpoint is a public API with no account behind it.
      description: t('app.home.weather_description'),
      route: 'weather',
      testID: 'weather',
      title: t('app.home.weather_title'),
    },
    {
      description: t('app.home.courses_description'),
      route: 'courses',
      testID: 'course-schedule',
      title: t('app.home.courses_title'),
    },
    {
      description: t('app.home.scores_description'),
      route: 'scores',
      testID: 'scores',
      title: t('app.home.scores_title'),
    },
    {
      description: t('app.home.calculator_description'),
      route: 'calculator',
      testID: 'calculator',
      title: t('app.home.calculator_title'),
    },
  ];
  const languages: Array<{label: string; value: string}> = [
    {label: '中文', value: 'zh'},
    {label: 'English', value: 'en'},
    {label: '日本語', value: 'ja'},
  ];

  return (
    <ScrollView
      contentContainerStyle={styles.homeContent}
      testID="home-screen"
      style={{backgroundColor: color.ham_bg_b1}}>
      <View style={styles.hero}>
        <Text
          accessibilityLabel="home-title"
          style={[styles.appTitle, {color: color.ham_text_primary}]}
          testID="home-title">
          {t('app.title')}
        </Text>
        <Text style={[styles.tagline, {color: color.ham_text_secondary}]}>
          {t('app.tagline')}
        </Text>
      </View>

      <View style={styles.featureList}>
        {features.map(feature => (
          <FeatureCard
            description={feature.description}
            key={feature.route}
            onPress={() => onOpen(feature.route)}
            testID={feature.testID}
            title={feature.title}
          />
        ))}
      </View>

      <View
        style={[
          styles.noticeCard,
          {backgroundColor: color.ham_lightBlue, borderColor: color.ham_blue},
        ]}>
        <Text style={[styles.noticeTitle, {color: color.ham_text_primary}]}>
          {t('app.privacy_title')}
        </Text>
        <Text style={[styles.noticeText, {color: color.ham_text_secondary}]}>
          {t('app.privacy_description')}
        </Text>
      </View>

      <Pressable
        accessibilityLabel="clear-login"
        accessibilityRole="button"
        testID="clear-login"
        onPress={() => {
          void CasModule.clearCasCookie()
            .then(cleared => {
              Alert.alert(
                t('app.clear_login'),
                cleared
                  ? t('app.clear_login_success')
                  : t('app.clear_login_failed'),
              );
            })
            .catch(() => {
              Alert.alert(t('app.clear_login'), t('app.clear_login_failed'));
            });
        }}
        style={({pressed}) => [
          styles.clearLoginButton,
          {
            backgroundColor: color.ham_bg_b2,
            borderColor: color.ham_divider,
            opacity: pressed ? 0.65 : 1,
          },
        ]}>
        <Text style={[styles.clearLoginLabel, {color: color.ham_red}]}>
          {t('app.clear_login')}
        </Text>
      </Pressable>

      <View style={styles.languageSection}>
        <Text style={[styles.sectionTitle, {color: color.ham_text_secondary}]}>
          {t('app.language')}
        </Text>
        <View style={styles.languageRow}>
          {languages.map(language => {
            const selected = activeI18n.resolvedLanguage === language.value;
            return (
              <Pressable
                accessibilityRole="button"
                key={language.value}
                onPress={() => {
                  void activeI18n.changeLanguage(language.value);
                }}
                style={({pressed}) => [
                  styles.languageButton,
                  {
                    backgroundColor: selected
                      ? color.ham_blue
                      : color.ham_bg_b2,
                    borderColor: selected ? color.ham_blue : color.ham_divider,
                    opacity: pressed ? 0.72 : 1,
                  },
                ]}>
                <Text
                  style={[
                    styles.languageLabel,
                    {
                      color: selected
                        ? color.ham_bg_b2
                        : color.ham_text_primary,
                    },
                  ]}>
                  {language.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Text style={[styles.version, {color: color.ham_text_secondary}]}>
        {t('app.version', {
          build: buildNumber ?? '-',
          version: appVersion ?? '-',
        })}
      </Text>
    </ScrollView>
  );
};

const HamApp = ({appVersion, buildNumber}: HamAppProps): React.JSX.Element => {
  const color = useColor();
  const {i18n: activeI18n} = useTranslation();
  const [route, setRoute] = useState<AppRoute>('home');

  useEffect(() => {
    const subscription = NativeCommonModule.onLocaleChanged(() => {
      void activeI18n.changeLanguage(NativeCommonModule.getLocale());
    });
    return () => subscription.remove();
  }, [activeI18n]);

  const content = (() => {
    switch (route) {
      case 'courses':
        return <CourseScreen onBack={() => setRoute('home')} />;
      case 'scores':
        return <ScoreScreen onBack={() => setRoute('home')} />;
      case 'calculator':
        return <GpaCalculatorScreen onBack={() => setRoute('home')} />;
      case 'weather':
        return <WeatherScreen onBack={() => setRoute('home')} />;
      case 'home':
      default:
        return (
          <HomeScreen
            appVersion={appVersion}
            buildNumber={buildNumber}
            onOpen={setRoute}
          />
        );
    }
  })();

  return (
    <SafeAreaProvider>
      <SafeAreaView
        style={[styles.safeArea, {backgroundColor: color.ham_bg_b1}]}>
        <StatusBar
          barStyle={
            Appearance.getColorScheme() === 'dark'
              ? 'light-content'
              : 'dark-content'
          }
        />
        {content}
      </SafeAreaView>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  appTitle: {
    fontSize: 42,
    fontWeight: '700',
    letterSpacing: -1,
  },
  clearLoginButton: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  clearLoginLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  featureCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
    padding: 18,
  },
  featureDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  featureList: {
    gap: 12,
  },
  featureTitle: {
    fontSize: 19,
    fontWeight: '600',
  },
  hero: {
    gap: 8,
    paddingBottom: 12,
    paddingTop: 20,
  },
  homeContent: {
    gap: 24,
    padding: 20,
    paddingBottom: 40,
  },
  languageButton: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  languageLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  languageRow: {
    flexDirection: 'row',
    gap: 8,
  },
  languageSection: {
    gap: 10,
  },
  noticeCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
    padding: 16,
  },
  noticeText: {
    fontSize: 14,
    lineHeight: 20,
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  safeArea: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  tagline: {
    fontSize: 16,
    lineHeight: 24,
  },
  version: {
    fontSize: 12,
    textAlign: 'center',
  },
});

export default HamApp;
export type {AppRoute, HamAppProps};
