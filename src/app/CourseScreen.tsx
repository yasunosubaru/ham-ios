import React, {useCallback, useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import AppHeader from '@/app/components/AppHeader';
import StatusPanel from '@/app/components/StatusPanel';
import TermSelector from '@/app/components/TermSelector';
import type {AcademicTerm} from '@/app/components/TermSelector';
import CasMobileLoginView from '@/components/cas/CasMobileLoginView';
import {ReAuthLoginView} from '@/components/cas/ReAuthLoginView';
import {CasReAuthLoginError, loginEducation} from '@/business/education/api';
import {generateValidate} from '@/business/education/api';
import {getCourseList} from '@/business/education/course';
import type {CourseEntity} from '@/business/education/course';
import {toNativeCoursePairing} from '@/business/education/course/parser';
import CasModule from '@/modules/NativeCasModule';
import {describeError} from '@/utils/error';
import {useColor} from '@/utils/color/color';
import PrimaryButton from '@/utils/ui/PrimaryButton';
import {requestGet} from '@/utils/request/request';

interface CourseRow {
  course: CourseEntity;
  weeks: number[];
}

const getCurrentAcademicTerm = (date = new Date()): AcademicTerm => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  if (month >= 8) {
    return {semester: 1, year};
  }
  return {semester: 2, year: year - 1};
};

const CourseScreen = ({onBack}: {onBack: () => void}): React.JSX.Element => {
  const color = useColor();
  const {t} = useTranslation();
  const [term, setTerm] = useState<AcademicTerm>(getCurrentAcademicTerm);
  const [rows, setRows] = useState<CourseRow[]>([]);
  const [ignoredCount, setIgnoredCount] = useState(0);
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);
  const [hasCasCookie, setHasCasCookie] = useState(
    () => CasModule.requestCasCookie().trim().length > 0,
  );
  const [reAuthUrl, setReAuthUrl] = useState<string>();

  const fetchCourses = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(undefined);
    try {
      const [courseMap] = await getCourseList({
        semester: term.semester,
        validate: generateValidate(),
        year: term.year,
      });
      const [courses, grids, ignored] = toNativeCoursePairing(courseMap);
      setRows(
        courses.map((course, index) => ({
          course,
          weeks: Array.from(
            new Set(
              grids[index].map(grid => grid.week).filter(week => week > 0),
            ),
          ).sort((left, right) => left - right),
        })),
      );
      setIgnoredCount(ignored.length);
    } catch (caught) {
      if (caught instanceof CasReAuthLoginError) {
        setReAuthUrl(caught.url);
      } else {
        setError(describeError(caught));
      }
    } finally {
      setIsLoading(false);
    }
  }, [term]);

  const load = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(undefined);
    try {
      await loginEducation();
      await fetchCourses();
    } catch (caught) {
      if (caught instanceof CasReAuthLoginError) {
        setReAuthUrl(caught.url);
        setIsLoading(false);
      } else {
        setError(describeError(caught));
        setIsLoading(false);
      }
    }
  }, [fetchCourses]);

  const completeReAuth = (ticketUrl: string): void => {
    setReAuthUrl(undefined);
    setIsLoading(true);
    void requestGet({
      headers: {Cookie: CasModule.requestCasCookie()},
      url: ticketUrl,
    })
      .then(fetchCourses)
      .catch(caught => {
        setError(describeError(caught));
        setIsLoading(false);
      });
  };

  if (reAuthUrl) {
    return (
      <View style={[styles.screen, {backgroundColor: color.ham_bg_b1}]}>
        <AppHeader onBack={onBack} title={t('app.courses.title')} />
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
        <AppHeader onBack={onBack} title={t('app.courses.title')} />
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
      <AppHeader onBack={onBack} title={t('app.courses.title')} />
      {isLoading ? (
        <StatusPanel retryLabel={t('app.retry')} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          <Text style={[styles.description, {color: color.ham_text_secondary}]}>
            {t('app.courses.description')}
          </Text>
          <TermSelector onChange={setTerm} term={term} />
          <PrimaryButton
            accessibilityLabel={t('app.courses.fetch')}
            label={
              rows.length > 0
                ? t('app.courses.refresh')
                : t('app.courses.fetch')
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
          {rows.length > 0 ? (
            <View style={styles.courseList}>
              {rows.map(row => {
                const {course} = row;
                const weekText =
                  row.weeks.length > 0
                    ? t('app.courses.week_list', {
                        weeks: row.weeks.join(', '),
                      })
                    : t('app.common.unknown');
                const weekdayText =
                  course.weekday >= 0 && course.weekday <= 7
                    ? t(`app.weekday_${course.weekday}`)
                    : t('app.common.unknown');
                const classText =
                  course.classFrom > 0
                    ? t('app.courses.classes', {
                        from: course.classFrom,
                        to: course.classTo,
                      })
                    : t('app.common.unknown');
                return (
                  <View
                    key={`${course.courseId}-${course.name}-${course.instructor}`}
                    style={[
                      styles.courseCard,
                      {
                        backgroundColor: color.ham_bg_b2,
                        borderColor: color.ham_divider,
                      },
                    ]}>
                    <View
                      style={[
                        styles.courseAccent,
                        {backgroundColor: course.color || color.ham_blue},
                      ]}
                    />
                    <View style={styles.courseBody}>
                      <Text
                        style={[
                          styles.courseName,
                          {color: color.ham_text_primary},
                        ]}>
                        {course.name || t('education.unnamed_course')}
                      </Text>
                      <Text
                        style={[
                          styles.courseMeta,
                          {color: color.ham_text_secondary},
                        ]}>
                        {t('app.courses.instructor', {
                          name: course.instructor || t('app.common.unknown'),
                        })}
                      </Text>
                      <Text
                        style={[
                          styles.courseMeta,
                          {color: color.ham_text_secondary},
                        ]}>
                        {t('app.courses.schedule', {
                          classes: classText,
                          weekday: weekdayText,
                          weeks: weekText,
                        })}
                      </Text>
                      <Text
                        style={[
                          styles.courseMeta,
                          {color: color.ham_text_secondary},
                        ]}>
                        {t('app.courses.location', {
                          name: course.location || t('app.common.unknown'),
                        })}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : error ? null : (
            <Text style={[styles.empty, {color: color.ham_text_secondary}]}>
              {t('app.courses.empty')}
            </Text>
          )}
          {ignoredCount > 0 ? (
            <Text style={[styles.warning, {color: color.ham_orange}]}>
              {t('app.courses.ignored', {count: ignoredCount})}
            </Text>
          ) : null}
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
  courseAccent: {
    borderRadius: 2,
    width: 4,
  },
  courseBody: {
    flex: 1,
    gap: 5,
  },
  courseCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    overflow: 'hidden',
    padding: 14,
  },
  courseList: {
    gap: 10,
  },
  courseMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  courseName: {
    fontSize: 17,
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
  screen: {
    flex: 1,
  },
  warning: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
});

export default CourseScreen;
export {getCurrentAcademicTerm};
