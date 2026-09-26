import React, {useCallback, useMemo, useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import AppHeader from '@/app/components/AppHeader';
import StatusPanel from '@/app/components/StatusPanel';
import CasMobileLoginView from '@/components/cas/CasMobileLoginView';
import {ReAuthLoginView} from '@/components/cas/ReAuthLoginView';
import {
  CasReAuthLoginError,
  generateValidate,
  loginEducation,
} from '@/business/education/api';
import {getScoreList} from '@/business/education/score';
import type {ScoreEntity} from '@/business/education/score/type';
import CasModule from '@/modules/NativeCasModule';
import {describeError} from '@/utils/error';
import {useColor} from '@/utils/color/color';
import PrimaryButton from '@/utils/ui/PrimaryButton';
import {requestGet} from '@/utils/request/request';

const ScoreScreen = ({onBack}: {onBack: () => void}): React.JSX.Element => {
  const color = useColor();
  const {t} = useTranslation();
  const [scores, setScores] = useState<ScoreEntity[]>([]);
  const [userName, setUserName] = useState('');
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);
  const [hasCasCookie, setHasCasCookie] = useState(
    () => CasModule.requestCasCookie().trim().length > 0,
  );
  const [reAuthUrl, setReAuthUrl] = useState<string>();

  const fetchScores = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(undefined);
    try {
      const [items, userInfo] = await getScoreList({
        validate: generateValidate(),
      });
      setScores(items);
      setUserName(userInfo.name);
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const load = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(undefined);
    try {
      await loginEducation();
      await fetchScores();
    } catch (caught) {
      if (caught instanceof CasReAuthLoginError) {
        setReAuthUrl(caught.url);
        setIsLoading(false);
      } else {
        setError(describeError(caught));
        setIsLoading(false);
      }
    }
  }, [fetchScores]);

  const completeReAuth = (ticketUrl: string): void => {
    setReAuthUrl(undefined);
    setIsLoading(true);
    void requestGet({
      headers: {Cookie: CasModule.requestCasCookie()},
      url: ticketUrl,
    })
      .then(fetchScores)
      .catch(caught => {
        setError(describeError(caught));
        setIsLoading(false);
      });
  };

  const summary = useMemo(() => {
    const valid = scores.filter(
      item => Number.isFinite(item.credit) && Number.isFinite(item.score),
    );
    const credits = valid.reduce((total, item) => total + item.credit, 0);
    const weighted = valid.reduce(
      (total, item) => total + item.credit * item.score,
      0,
    );
    return {
      average: credits > 0 ? weighted / credits : 0,
      count: valid.length,
      credits,
    };
  }, [scores]);

  if (reAuthUrl) {
    return (
      <View style={[styles.screen, {backgroundColor: color.ham_bg_b1}]}>
        <AppHeader onBack={onBack} title={t('app.scores.title')} />
        <ReAuthLoginView
          onGetTicketUrl={completeReAuth}
          reAuthUrl={reAuthUrl}
          style={styles.flex}
        />
      </View>
    );
  }

  if (!hasCasCookie) {
    return (
      <View style={[styles.screen, {backgroundColor: color.ham_bg_b1}]}>
        <AppHeader onBack={onBack} title={t('app.scores.title')} />
        <CasMobileLoginView
          onLoginSuccess={() => {
            setHasCasCookie(true);
            void load();
          }}
          style={styles.flex}
        />
      </View>
    );
  }

  return (
    <View style={[styles.screen, {backgroundColor: color.ham_bg_b1}]}>
      <AppHeader onBack={onBack} title={t('app.scores.title')} />
      {isLoading ? (
        <StatusPanel retryLabel={t('app.retry')} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.description, {color: color.ham_text_secondary}]}>
            {t('app.scores.description')}
          </Text>
          <PrimaryButton
            accessibilityLabel={t('app.scores.fetch')}
            label={
              scores.length > 0
                ? t('app.scores.refresh')
                : t('app.scores.fetch')
            }
            onPress={() => {
              void load();
            }}
          />
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
                  style={[
                    styles.summaryTitle,
                    {color: color.ham_text_primary},
                  ]}>
                  {userName || t('app.scores.title')}
                </Text>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryItem}>
                    <Text
                      style={[styles.summaryValue, {color: color.ham_blue}]}>
                      {summary.average.toFixed(2)}
                    </Text>
                    <Text
                      style={[
                        styles.summaryLabel,
                        {color: color.ham_text_secondary},
                      ]}>
                      {t('app.scores.weighted_average')}
                    </Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text
                      style={[styles.summaryValue, {color: color.ham_blue}]}>
                      {summary.credits.toFixed(1)}
                    </Text>
                    <Text
                      style={[
                        styles.summaryLabel,
                        {color: color.ham_text_secondary},
                      ]}>
                      {t('app.scores.credits')}
                    </Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text
                      style={[styles.summaryValue, {color: color.ham_blue}]}>
                      {summary.count}
                    </Text>
                    <Text
                      style={[
                        styles.summaryLabel,
                        {color: color.ham_text_secondary},
                      ]}>
                      {t('app.scores.course_count')}
                    </Text>
                  </View>
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
                      <Text
                        style={[styles.scoreValue, {color: color.ham_blue}]}>
                        {item.score}
                      </Text>
                      <Text
                        style={[
                          styles.scoreCredit,
                          {color: color.ham_text_secondary},
                        ]}>
                        {t('app.scores.credit_value', {
                          value: item.credit,
                        })}
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
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  content: {
    gap: 18,
    padding: 18,
    paddingBottom: 40,
  },
  courseName: {
    fontSize: 16,
    fontWeight: '600',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
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
