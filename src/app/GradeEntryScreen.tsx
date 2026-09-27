import React, {useCallback, useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import AppHeader from '@/app/components/AppHeader';
import CasMobileLoginView from '@/components/cas/CasMobileLoginView';
import EducationPageView, {
  TEACHER_PAGE_URL,
} from '@/components/education/EducationPageView';
import CasModule from '@/modules/NativeCasModule';
import {describeError} from '@/utils/error';
import {useColor} from '@/utils/color/color';
import PrimaryButton from '@/utils/ui/PrimaryButton';

/**
 * Grade entry and the list of courses awaiting marks.
 *
 * The teacher view is the *same page* as the student score query -- same path,
 * same `gnmkdm` (`N305005`) -- branched by a hidden `jsxx` field the server sets
 * from the account's role, with `doType=query` and `zd_fzdm=N305005-gly` added.
 * So which view appears follows from the account that signed in, and this screen
 * only has to point at the page and read the reply.
 *
 * Two things about it are known and one is not:
 *
 *   - The captcha is not in the way. All three of the page's checks read
 *     `... && jsxx == "xs"`, so it applies to the student view only. A teacher
 *     account never meets it. That is the university's own arrangement.
 *   - Twelve teacher-side write endpoints are visible in the page's script,
 *     among them `/cjcx/cjcx_cxBcxscjmxdx.html` for a mark detail row and
 *     `/mxdx/mxdx_cxMxdx.html?table_039` for the component ratios.
 *   - Which endpoint answers a given query, and what its field names are, could
 *     not be established without a session: every `.html` on the host redirects
 *     to the login page whether or not it exists, so there is no way to tell a
 *     real path from an invented one anonymously.
 *
 * So nothing here is rendered from guessed field names. The reply is shown as
 * what it is -- an endpoint and the key/value pairs that came back -- and the
 * first run with a real account is what turns those into named fields. Writing a
 * plausible-looking mapping now would present guesses as a contract, which is
 * the exact failure that let a token bug ship behind a green suite once already.
 *
 * This screen writes nothing. It reads what the page returns and stops there.
 */
const GRADE_TARGETS = [
  'cjcx_cxXsgrcj',
  'cjcx_cxDgXscj',
  'cxBcxscjmxdx',
  'mxdx_cxMxdx',
  'cjcx_plgxBkxscj',
  'cjcx_sjtbXscj',
  'cjcx_cxXxCount',
];

interface Captured {
  body: unknown;
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
        // Held as the parsed value and rendered structurally, so nothing has to
        // be cast into a shape before anyone has seen a real reply.
        setCaptured(previous => [...previous, {body: JSON.parse(body), url}]);
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

        {captured.map((entry, index) => (
          <View
            key={`${entry.url}-${index}`}
            style={[
              styles.card,
              {
                backgroundColor: color.ham_bg_b2,
                borderColor: color.ham_divider,
              },
            ]}>
            <Text style={[styles.cardTitle, {color: color.ham_text_primary}]}>
              {t('app.grades.endpoint', {url: endpointOf(entry.url)})}
            </Text>
            <Fields value={entry.body} />
          </View>
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

/** The path and query, without the host, so the label stays readable. */
const endpointOf = (url: string): string => {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
};

/**
 * Renders a reply as key/value pairs, descending into arrays and objects.
 *
 * A fixed set of named fields would be a guess; this shows the structure the
 * service actually sent, which is both honest and the thing needed to write the
 * real mapping.
 */
const Fields = ({value}: {value: unknown}): React.JSX.Element => {
  const color = useColor();
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <Text style={[styles.scalar, {color: color.ham_text_secondary}]}>
          []
        </Text>
      );
    }
    return (
      <>
        <Text style={[styles.count, {color: color.ham_text_secondary}]}>
          {value.length}
        </Text>
        {value.slice(0, 20).map((item, index) => (
          <View
            key={index}
            style={[styles.nested, {borderColor: color.ham_divider}]}>
            <Fields value={item} />
          </View>
        ))}
        {value.length > 20 ? (
          <Text style={[styles.count, {color: color.ham_text_secondary}]}>
            …
          </Text>
        ) : null}
      </>
    );
  }
  if (typeof value === 'object' && value !== null) {
    return (
      <>
        {Object.entries(value as {[key: string]: unknown}).map(
          ([key, item]) => (
            <View
              key={key}
              style={[styles.row, {borderColor: color.ham_divider}]}>
              <Text style={[styles.key, {color: color.ham_text_secondary}]}>
                {key}
              </Text>
              <Fields value={item} />
            </View>
          ),
        )}
      </>
    );
  }
  return (
    <Text style={[styles.scalar, {color: color.ham_text_primary}]}>
      {value === null ? '—' : `${value}`}
    </Text>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
    padding: 14,
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
  count: {
    fontSize: 11,
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
  footnote: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  key: {
    flex: 1,
    fontSize: 12,
  },
  nested: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    marginLeft: 4,
    paddingLeft: 10,
  },
  row: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    paddingTop: 6,
  },
  scalar: {
    flex: 2,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
  },
  screen: {
    flex: 1,
  },
});

export default GradeEntryScreen;
export {GRADE_TARGETS};
