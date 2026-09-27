import React, {useCallback, useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import AppHeader from '@/app/components/AppHeader';
import CasMobileLoginView from '@/components/cas/CasMobileLoginView';
import EducationPageView, {
  SCORE_PAGE_URL,
} from '@/components/education/EducationPageView';
import {DEFAULT_TARGETS} from '@/components/education/scoreHook';
import {parseResponse} from '@/business/education/score/parser';
import type {ScoreEntity} from '@/business/education/score/type';
import CasModule from '@/modules/NativeCasModule';
import {useColor} from '@/utils/color/color';
import PrimaryButton from '@/utils/ui/PrimaryButton';
import {describeError} from '@/utils/error';

/**
 * Score query, driven through the education system's own page.
 *
 * This used to be a plain HTTP POST. That cannot work when the system asks for a
 * captcha, and the system does: its page gates the query behind one and passes
 * the vendor's token in as `validate`, so a fabricated value is rejected. The
 * page now makes its own request and this screen reads the reply -- see
 * `EducationPageView` for why the sign-in has to happen in the WebView too.
 *
 * The parser is the one that was already here, unchanged. Its field names are
 * confirmed against the page's own grid model (`bfzcj`, `xf`, `kcmc`, `jsxm`,
 * `jxbmc`, `kkbmmc`, `kcxzmc`, `xnm`, `xqm`, `xh`, `xm` all appear there), which
 * is why the results render the same way as before.
 *
 * Scores stay in component state. Leaving the screen drops them, and nothing is
 * written to a database.
 */
const SCORE_TARGETS = DEFAULT_TARGETS;
const ScoreScreen = ({onBack}: {onBack: () => void}): React.JSX.Element => {
  const color = useColor();
  const {t} = useTranslation();
  const [scores, setScores] = useState<ScoreEntity[]>([]);
  const [userName, setUserName] = useState('');
  const [error, setError] = useState<string>();
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [hasQueried, setHasQueried] = useState(false);
  const [hasCasCookie, setHasCasCookie] = useState(
    () => CasModule.requestCasCookie().trim().length > 0,
  );

  const handleScores = useCallback(
    (body: string): void => {
      setError(undefined);
      setHasQueried(true);
      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch {
        setError(t('app.scores.parse_failed'));
        return;
      }
      try {
        const [items, userInfo] = parseResponse({
          json: parsed as {items: never[]},
        });
        setScores(items);
        setUserName(userInfo.name);
      } catch (caught) {
        setError(describeError(caught));
      }
    },
    [t],
  );

  const handleUnavailable = useCallback((): void => {
    setHasQueried(true);
    setError(t('app.scores.unavailable'));
  }, [t]);

  if (!hasCasCookie) {
    return (
      <View style={[styles.screen, {backgroundColor: color.ham_bg_b1}]}>
        <AppHeader onBack={onBack} title={t('app.scores.title')} />
        <CasMobileLoginView
          onLoginSuccess={() => {
            setHasCasCookie(true);
          }}
          style={styles.flex}
        />
      </View>
    );
  }

  // The page stays up until there is something to show, or until the reply said
  // it could not be read. Falling back to the page on a bad reply rather than to
  // an empty list is the honest default: "no scores" and "could not read the
  // answer" are different things, and only one of them is the user's situation.
  if (!hasQueried) {
    return (
      <View style={[styles.screen, {backgroundColor: color.ham_bg_b1}]}>
        <AppHeader onBack={onBack} title={t('app.scores.title')} />
        {captchaRequired ? (
          <View
            style={[styles.captchaBar, {backgroundColor: color.ham_lightBlue}]}>
            <Text
              style={[styles.captchaText, {color: color.ham_text_secondary}]}>
              {t('app.scores.captcha_required')}
            </Text>
          </View>
        ) : null}
        <EducationPageView
          notice={t('app.scores.page_notice')}
          onNeedsCaptcha={setCaptchaRequired}
          onResult={({body}) => {
            handleScores(body);
          }}
          onUnavailable={() => {
            handleUnavailable();
          }}
          pageUrl={SCORE_PAGE_URL}
          targets={SCORE_TARGETS}
          style={styles.flex}
        />
      </View>
    );
  }

  return (
    <View style={[styles.screen, {backgroundColor: color.ham_bg_b1}]}>
      <AppHeader onBack={onBack} title={t('app.scores.title')} />
      <ScrollView contentContainerStyle={styles.content}>
        {captchaRequired ? (
          <Text style={[styles.captchaHint, {color: color.ham_text_secondary}]}>
            {t('app.scores.captcha_required')}
          </Text>
        ) : null}

        {error ? (
          <View
            style={[
              styles.errorCard,
              {backgroundColor: color.ham_bg_b2, borderColor: color.ham_red},
            ]}>
            <Text style={[styles.errorText, {color: color.ham_red}]}>
              {error}
            </Text>
          </View>
        ) : null}

        {scores.length > 0 ? (
          <>
            <View
              style={[
                styles.summaryCard,
                {backgroundColor: color.ham_lightBlue},
              ]}>
              <Text
                style={[styles.summaryTitle, {color: color.ham_text_primary}]}>
                {userName || t('app.scores.title')}
              </Text>
              <View style={styles.summaryRow}>
                <Summary
                  label={t('app.scores.weighted_average')}
                  value={averageOf(scores).toFixed(2)}
                />
                <Summary
                  label={t('app.scores.credits')}
                  value={creditsOf(scores).toFixed(1)}
                />
                <Summary
                  label={t('app.scores.course_count')}
                  value={`${scores.length}`}
                />
              </View>
            </View>
            <View style={styles.scoreList}>
              {scores.map((item, index) => (
                <View
                  key={`${item.courseId}-${item.name}-${item.instructor}-${index}`}
                  style={[
                    styles.scoreCard,
                    {
                      backgroundColor: color.ham_bg_b2,
                      borderColor: color.ham_divider,
                    },
                  ]}>
                  <View style={styles.scoreBody}>
                    <Text
                      style={[
                        styles.courseName,
                        {color: color.ham_text_primary},
                      ]}>
                      {item.name || t('education.unnamed_course')}
                    </Text>
                    <Text
                      style={[
                        styles.scoreMeta,
                        {color: color.ham_text_secondary},
                      ]}>
                      {t('app.scores.term', {
                        semester: item.semester,
                        year: item.year,
                      })}
                    </Text>
                    <Text
                      style={[
                        styles.scoreMeta,
                        {color: color.ham_text_secondary},
                      ]}>
                      {t('app.courses.instructor', {
                        name: item.instructor || t('app.common.unknown'),
                      })}
                    </Text>
                  </View>
                  <View style={styles.scoreValueBlock}>
                    <Text style={[styles.scoreValue, {color: color.ham_blue}]}>
                      {item.score}
                    </Text>
                    <Text
                      style={[
                        styles.scoreCredit,
                        {color: color.ham_text_secondary},
                      ]}>
                      {t('app.scores.credit_value', {value: item.credit})}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
            <Text style={[styles.privacy, {color: color.ham_text_secondary}]}>
              {t('app.scores.memory_only')}
            </Text>
          </>
        ) : error ? null : (
          <Text style={[styles.empty, {color: color.ham_text_secondary}]}>
            {t('app.scores.empty')}
          </Text>
        )}

        <PrimaryButton
          accessibilityLabel={t('app.scores.refresh')}
          label={t('app.scores.refresh')}
          onPress={() => {
            setHasQueried(false);
            setError(undefined);
          }}
        />
      </ScrollView>
    </View>
  );
};

/** Courses with a usable score and credit, which is what a weighted mean needs. */
const countable = (scores: ScoreEntity[]): ScoreEntity[] =>
  scores.filter(
    item => Number.isFinite(item.credit) && Number.isFinite(item.score),
  );

const averageOf = (scores: ScoreEntity[]): number => {
  const valid = countable(scores);
  const credits = valid.reduce((total, item) => total + item.credit, 0);
  if (credits <= 0) {
    return 0;
  }
  return (
    valid.reduce((total, item) => total + item.credit * item.score, 0) / credits
  );
};

const creditsOf = (scores: ScoreEntity[]): number =>
  countable(scores).reduce((total, item) => total + item.credit, 0);

const Summary = ({label, value}: {label: string; value: string}) => {
  const color = useColor();
  return (
    <View style={styles.summaryItem}>
      <Text style={[styles.summaryValue, {color: color.ham_blue}]}>
        {value}
      </Text>
      <Text style={[styles.summaryLabel, {color: color.ham_text_secondary}]}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  captchaBar: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  captchaHint: {
    fontSize: 12,
    lineHeight: 18,
  },
  captchaText: {
    fontSize: 12,
    lineHeight: 18,
  },
  content: {
    gap: 18,
    padding: 18,
    paddingBottom: 40,
  },
  courseName: {
    fontSize: 16,
    fontWeight: '600',
  },
  empty: {
    fontSize: 15,
    paddingVertical: 28,
    textAlign: 'center',
  },
  errorCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
  },
  flex: {
    flex: 1,
  },
  privacy: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  scoreBody: {
    flex: 1,
    gap: 4,
  },
  scoreCard: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  scoreCredit: {
    fontSize: 11,
    textAlign: 'center',
  },
  scoreList: {
    gap: 9,
  },
  scoreMeta: {
    fontSize: 12,
    lineHeight: 17,
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  scoreValueBlock: {
    alignItems: 'center',
    minWidth: 64,
  },
  screen: {
    flex: 1,
  },
  summaryCard: {
    borderRadius: 16,
    gap: 14,
    padding: 16,
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
    gap: 3,
  },
  summaryLabel: {
    fontSize: 11,
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
  },
});

export default ScoreScreen;
export {averageOf, creditsOf};
