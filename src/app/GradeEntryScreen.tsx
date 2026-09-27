import React, {useCallback, useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import AppHeader from '@/app/components/AppHeader';
import CasMobileLoginView from '@/components/cas/CasMobileLoginView';
import EducationPageView, {
  TEACHER_PAGE_URL,
} from '@/components/education/EducationPageView';
import {
  COURSE_COLUMNS,
  GRADE_QUERY_PATH,
  hasPageLabel,
  partitionRecord,
  ROSTER_COLUMNS,
  rowsOf,
  STUDENT_GRADE_QUERY_PATH,
} from '@/business/education/grades/columns';
import CasModule from '@/modules/NativeCasModule';
import {describeError} from '@/utils/error';
import {useColor} from '@/utils/color/color';
import PrimaryButton from '@/utils/ui/PrimaryButton';

/**
 * Grade entry: the courses awaiting marks, and what the page says about them.
 *
 * The teacher view is the *same page* as the student score query -- same path,
 * same `gnmkdm` (`N305005`) -- branched by a hidden `jsxx` field the server sets
 * from the account's role, with `doType=query` and `zd_fzdm=N305005-gly` added.
 * So which view appears follows from the account that signed in, and this screen
 * only has to point at the page and read the reply.
 *
 * The query endpoint is no longer a guess. The grid's own source says:
 *
 *     url: _path + ($("#jsxx").val() == "xs" ? '/cjcx/cjcx_cxXsgrcj.html'
 *                                               : '/cjcx/cjcx_cxDgXscj.html')
 *            + '?doType=query'
 *
 * so a teacher's grade query is `POST /cjcx/cjcx_cxDgXscj.html?doType=query` --
 * this page, querying itself, with `paramMap()`'s 44 fields as the body. That is
 * the first time the endpoint has been known rather than inferred, and it is why
 * {@link GRADE_TARGETS} leads with it.
 *
 * What a teacher should expect to get back is a **course list**, not a roster:
 * the grid is `multiselect: $("#jsxx").val() != "xs"` for exactly this role, so a
 * teacher ticks courses and then acts on them, and a single student's marks are
 * reached from a dialog that takes `xh_id` and `kch_id` off the chosen row. The
 * screen still decides what it got from the reply rather than from this, since
 * nothing has been observed yet.
 *
 * Two things about it are known and one is not:
 *
 *   - The captcha is not in the way. All three of the page's checks read
 *     `... && jsxx == "xs"`, so it applies to the student view only. A teacher
 *     account never meets it. That is the university's own arrangement.
 *   - The field vocabulary is known, from the page's own 108 column definitions
 *     resolved for Wuhan's school code. See `grades/columns.ts`.
 *   - The reply's envelope is not known. The grid is built on a shared
 *     `BaseJqGrid` wrapper that is not reachable, and `rows`, `records`, `total`
 *     and `setGridData` appear nowhere in the page's own source.
 *
 * So the screen reads whatever arrives, names the fields it recognises, and
 * **shows the rest rather than hiding it**. A field this list has never heard of
 * is a fact about the reply, and dropping it would make the app look finished
 * when it is not. Every reply is also shown with the endpoint that produced it,
 * because the envelope is a guess and a guess is only checkable if the thing it
 * guessed about stays visible.
 *
 * This screen writes nothing. It reads what the page returns and stops there.
 */

/**
 * Endpoints whose replies are read.
 *
 * The first is the one the page's source names outright, for a teacher's grade
 * query; the second is its student-side counterpart, in case an account sees
 * both. The rest are the grid's neighbours -- a mark breakdown, a component
 * ratio list, a count -- and are watched because which of them a given query
 * reaches is not something the source states. They cost nothing to read and
 * would be invisible if missed.
 */
const GRADE_TARGETS = [
  GRADE_QUERY_PATH.slice(GRADE_QUERY_PATH.lastIndexOf('/') + 1),
  STUDENT_GRADE_QUERY_PATH.slice(STUDENT_GRADE_QUERY_PATH.lastIndexOf('/') + 1),
  'cxBcxscjmxdx',
  'mxdx_cxMxdx',
  'cjcx_plgxBkxscj',
  'cjcx_sjtbXscj',
  'cjcx_cxXxCount',
];

/** One captured reply, kept whole so the endpoint stays visible. */
interface Captured {
  id: number;
  json: unknown;
  url: string;
}

const GradeEntryScreen = ({
  onBack,
}: {
  onBack: () => void;
}): React.JSX.Element => {
  const color = useColor();
  const {t} = useTranslation();
  const [captured, setCaptured] = useState<Captured[]>([]);
  const [error, setError] = useState<string>();
  const [hasReplied, setHasReplied] = useState(false);
  const [hasCasCookie, setHasCasCookie] = useState(
    () => CasModule.requestCasCookie().trim().length > 0,
  );

  const handleResult = useCallback(
    ({body, url}: {body: string; url: string}): void => {
      setHasReplied(true);
      setError(undefined);
      try {
        setCaptured(previous => [
          ...previous,
          // The id keeps repeated replies from the same endpoint as separate
          // cards, which they are: a page reload re-runs the query.
          {id: previous.length, json: JSON.parse(body), url},
        ]);
      } catch (caught) {
        setError(describeError(caught));
      }
    },
    [],
  );

  const handleUnavailable = useCallback((): void => {
    setHasReplied(true);
    setError(t('app.grades.unavailable'));
  }, [t]);

  if (!hasCasCookie) {
    return (
      <View style={[styles.screen, {backgroundColor: color.ham_bg_b1}]}>
        <AppHeader onBack={onBack} title={t('app.grades.title')} />
        <CasMobileLoginView
          onLoginSuccess={() => {
            setHasCasCookie(true);
          }}
          style={styles.flex}
        />
      </View>
    );
  }

  if (!hasReplied) {
    return (
      <View style={[styles.screen, {backgroundColor: color.ham_bg_b1}]}>
        <AppHeader onBack={onBack} title={t('app.grades.title')} />
        <EducationPageView
          notice={t('app.grades.page_notice')}
          onResult={handleResult}
          onUnavailable={handleUnavailable}
          pageUrl={TEACHER_PAGE_URL}
          targets={GRADE_TARGETS}
          style={styles.flex}
        />
      </View>
    );
  }

  return (
    <View style={[styles.screen, {backgroundColor: color.ham_bg_b1}]}>
      <AppHeader onBack={onBack} title={t('app.grades.title')} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.description, {color: color.ham_text_secondary}]}>
          {t('app.grades.description')}
        </Text>

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

        {captured.length === 0 && !error ? (
          <Text style={[styles.empty, {color: color.ham_text_secondary}]}>
            {t('app.grades.empty')}
          </Text>
        ) : null}

        {captured.map(entry => (
          <Reply key={entry.id} captured={entry} />
        ))}

        <PrimaryButton
          accessibilityLabel={t('app.grades.back_to_page')}
          label={t('app.grades.back_to_page')}
          onPress={() => {
            setHasReplied(false);
            setCaptured([]);
            setError(undefined);
          }}
        />

        <Text style={[styles.footnote, {color: color.ham_text_secondary}]}>
          {t('app.grades.read_only')}
        </Text>
      </ScrollView>
    </View>
  );
};

const Reply = ({captured}: {captured: Captured}): React.JSX.Element => {
  const color = useColor();
  const {t} = useTranslation();
  const rows = useMemo(() => rowsOf(captured.json), [captured.json]);
  const [expanded, setExpanded] = useState(false);

  if (rows.length === 0) {
    // No list in it. A reply that is not a list is still information -- it may
    // be a status, a count, or an object keyed by course -- so it is shown
    // rather than replaced with "nothing to display".
    return (
      <View
        style={[
          styles.card,
          {backgroundColor: color.ham_bg_b2, borderColor: color.ham_divider},
        ]}>
        <Text style={[styles.cardTitle, {color: color.ham_text_primary}]}>
          {t('app.grades.endpoint', {url: endpointOf(captured.url)})}
        </Text>
        <Text style={[styles.empty, {color: color.ham_text_secondary}]}>
          {t('app.grades.no_list')}
        </Text>
        <Scalar value={captured.json} />
      </View>
    );
  }

  // Which of the two this is, decided from the reply rather than from the
  // endpoint. A teacher should get a course list -- the grid is multiselect for
  // that role so courses can be ticked before acting on them -- but nothing has
  // been observed yet, so the reply decides and the endpoint stays on screen.
  const isRoster = rows.some(row => row['xh'] !== undefined);
  const order = isRoster ? ROSTER_COLUMNS : COURSE_COLUMNS;
  const shown = expanded ? rows : rows.slice(0, 8);

  return (
    <View
      style={[
        styles.card,
        {backgroundColor: color.ham_bg_b2, borderColor: color.ham_divider},
      ]}>
      <Text style={[styles.cardTitle, {color: color.ham_text_primary}]}>
        {t('app.grades.endpoint', {url: endpointOf(captured.url)})}
      </Text>
      <Text style={[styles.cardMeta, {color: color.ham_text_secondary}]}>
        {isRoster
          ? t('app.grades.roster_rows', {count: rows.length})
          : t('app.grades.course_rows', {count: rows.length})}
      </Text>

      {shown.map((row, index) => {
        const {known, rest} = partitionRecord(row, order);
        return (
          <View
            key={`${index}-${String(row['key'] ?? row['jxb_id'] ?? index)}`}
            style={[styles.row, {borderColor: color.ham_divider}]}>
            {known.length === 0 ? (
              <Text style={[styles.scalar, {color: color.ham_text_secondary}]}>
                {t('app.grades.row_without_known_fields')}
              </Text>
            ) : (
              known.map(field => (
                <View key={field.name} style={styles.field}>
                  <Text
                    style={[
                      styles.fieldLabel,
                      {color: color.ham_text_secondary},
                      // A field the page never names is shown under its own
                      // name, in italics, so a raw identifier is not read as a
                      // word the university uses. `bfzcj` is the one that
                      // matters: it is what the page itself compares a mark
                      // against 60 and against 100.
                      !hasPageLabel(field.name) ? styles.unnamed : null,
                    ]}>
                    {field.label}
                  </Text>
                  <Text
                    style={[
                      styles.fieldValue,
                      {color: color.ham_text_primary},
                    ]}>
                    {renderValue(field.value)}
                  </Text>
                </View>
              ))
            )}
            {rest.length > 0 ? (
              <Text
                style={[styles.restNote, {color: color.ham_text_secondary}]}>
                {t('app.grades.extra_fields', {count: rest.length})}
              </Text>
            ) : null}
          </View>
        );
      })}

      {rows.length > shown.length ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setExpanded(true);
          }}
          testID={`grades-expand-${captured.id}`}>
          <Text style={[styles.more, {color: color.ham_blue}]}>
            {t('app.grades.show_all', {count: rows.length})}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
};

/** The path and query, without the host, so the label stays readable. */
const endpointOf = (url: string): string => {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
};

const renderValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return `${value}`;
};

/** A reply that is not a list at all, shown structurally. */
const Scalar = ({value}: {value: unknown}): React.JSX.Element => {
  const color = useColor();
  if (typeof value === 'object' && value !== null) {
    return (
      <>
        {Object.entries(value as {[key: string]: unknown}).map(
          ([key, item]) => (
            <View key={key} style={[styles.field, styles.fieldBorder]}>
              <Text
                style={[styles.fieldLabel, {color: color.ham_text_secondary}]}>
                {key}
              </Text>
              <Text
                style={[styles.fieldValue, {color: color.ham_text_primary}]}>
                {renderValue(item)}
              </Text>
            </View>
          ),
        )}
      </>
    );
  }
  return (
    <Text style={[styles.scalar, {color: color.ham_text_primary}]}>
      {renderValue(value)}
    </Text>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
    padding: 14,
  },
  cardMeta: {
    fontSize: 12,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  content: {
    gap: 14,
    padding: 18,
    paddingBottom: 40,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  empty: {
    fontSize: 14,
    lineHeight: 20,
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
  field: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 4,
  },
  fieldBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  fieldLabel: {
    flex: 1,
    fontSize: 12,
  },
  fieldValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
  },
  flex: {
    flex: 1,
  },
  footnote: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  more: {
    fontSize: 13,
    fontWeight: '600',
    paddingTop: 6,
    textAlign: 'center',
  },
  restNote: {
    fontSize: 11,
    fontStyle: 'italic',
    paddingTop: 4,
  },
  row: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 2,
    paddingTop: 8,
  },
  scalar: {
    fontSize: 13,
  },
  screen: {
    flex: 1,
  },
  // A field the page leaves unnamed. Italic so it reads as a placeholder for a
  // missing label rather than as a label in its own right.
  unnamed: {
    fontStyle: 'italic',
  },
});

export default GradeEntryScreen;
export {GRADE_TARGETS};
