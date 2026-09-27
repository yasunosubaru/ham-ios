import React, {useCallback, useEffect, useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import AppHeader from '@/app/components/AppHeader';
import StatusPanel from '@/app/components/StatusPanel';
import CasMobileLoginView from '@/components/cas/CasMobileLoginView';
import {getCurrentBooking, getLibraryConfig, signIn} from '@/business/library';
import type {LibraryConfig, LibraryRecord} from '@/business/library';
import CasModule from '@/modules/NativeCasModule';
import {describeError} from '@/utils/error';
import {useColor} from '@/utils/color/color';
import PrimaryButton from '@/utils/ui/PrimaryButton';

/**
 * Campus library seat booking.
 *
 * The service is a standard CAS client, so the app's existing university
 * session is enough: the CAS redirect carries it across and the service trades
 * what comes back for a session token. No second password is ever asked for,
 * which is the whole reason the alternative sign-in -- the one that posts a
 * username and an RSA-encrypted password and wants a captcha -- is not used.
 *
 * The library token is held in component state and never written anywhere. It
 * is a live session credential, and the same reasoning that keeps the CAS
 * cookie in the Keychain and the scores in memory applies here: leaving the
 * screen drops it.
 *
 * What the screen shows is split by how well it is known. The booking rules
 * come from an endpoint that needs no session and was verified against the live
 * service. The booking data needs the token, and the field names in those
 * replies were never observed, so they are shown as raw key/value pairs rather
 * than dressed up as fields this app knows exist.
 */
const LibraryScreen = ({onBack}: {onBack: () => void}): React.JSX.Element => {
  const color = useColor();
  const {t} = useTranslation();
  const [config, setConfig] = useState<LibraryConfig>();
  const [token, setToken] = useState<string>();
  const [booking, setBooking] = useState<LibraryRecord>();
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);
  const [hasCasCookie, setHasCasCookie] = useState(
    () => CasModule.requestCasCookie().trim().length > 0,
  );

  const load = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(undefined);
    try {
      // The rules first and on their own: they need no session, so they stay
      // useful even when the sign-in below them fails.
      const rules = await getLibraryConfig();
      setConfig(rules);
      const session = await signIn();
      setToken(session);
      setBooking(await getCurrentBooking(session));
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasCasCookie) {
      void load();
    }
    // Only on first mount, and only once the university session exists: the
    // sign-in depends on it, and retrying on every render would hammer the CAS
    // endpoint.
  }, [hasCasCookie, load]);

  if (!hasCasCookie) {
    return (
      <View style={[styles.screen, {backgroundColor: color.ham_bg_b1}]}>
        <AppHeader onBack={onBack} title={t('app.library.title')} />
        <CasMobileLoginView
          onLoginSuccess={() => {
            setHasCasCookie(true);
          }}
          style={styles.flex}
        />
      </View>
    );
  }

  return (
    <View style={[styles.screen, {backgroundColor: color.ham_bg_b1}]}>
      <AppHeader onBack={onBack} title={t('app.library.title')} />
      {isLoading && !config ? (
        <StatusPanel retryLabel={t('app.retry')} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.description, {color: color.ham_text_secondary}]}>
            {t('app.library.description')}
          </Text>

          {config ? (
            <View style={[styles.card, {backgroundColor: color.ham_lightBlue}]}>
              <Text style={[styles.cardTitle, {color: color.ham_text_primary}]}>
                {t('app.library.rules_title')}
              </Text>
              <View style={styles.ruleGrid}>
                <Rule
                  label={t('app.library.rule_advance_days')}
                  value={`${config.futureMakeDay}`}
                />
                <Rule
                  label={t('app.library.rule_max_minutes')}
                  value={`${config.futureCondTime}`}
                />
                <Rule
                  label={t('app.library.rule_group_max')}
                  value={`${config.teamMax}`}
                />
                <Rule
                  label={t('app.library.rule_cancel_minutes')}
                  value={`${config.cancelMinute}`}
                />
                <Rule
                  label={t('app.library.rule_extend_minutes')}
                  value={`${config.extendMinute}`}
                />
                <Rule
                  label={t('app.library.rule_breach_max')}
                  value={`${config.breachMax}`}
                />
              </View>
              <Text style={[styles.signing, {color: color.ham_text_secondary}]}>
                {config.hmac === 1
                  ? t('app.library.signing_required')
                  : t('app.library.signing_optional')}
              </Text>
            </View>
          ) : null}

          {config?.notice.zh ? (
            <View
              style={[
                styles.notice,
                {
                  backgroundColor: color.ham_bg_b2,
                  borderColor: color.ham_divider,
                },
              ]}>
              <Text
                style={[styles.noticeTitle, {color: color.ham_text_primary}]}>
                {t('app.library.notice_title')}
              </Text>
              {/* The notice arrives as HTML. Stripped to text rather than
                  rendered: the service's own front end injects it, and this app
                  has no business evaluating markup from a response body. */}
              <Text
                style={[styles.noticeBody, {color: color.ham_text_secondary}]}>
                {stripMarkup(config.notice.zh)}
              </Text>
            </View>
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

          {booking ? (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: color.ham_bg_b2,
                  borderColor: color.ham_divider,
                },
              ]}>
              <Text style={[styles.cardTitle, {color: color.ham_text_primary}]}>
                {t('app.library.booking_title')}
              </Text>
              <RecordFields record={booking} />
            </View>
          ) : null}

          <PrimaryButton
            accessibilityLabel={t('app.library.refresh')}
            label={t('app.library.refresh')}
            onPress={() => {
              void load();
            }}
          />

          <Text style={[styles.footnote, {color: color.ham_text_secondary}]}>
            {token
              ? t('app.library.session_active')
              : t('app.library.session_absent')}
          </Text>
        </ScrollView>
      )}
    </View>
  );
};

/** Renders an unobserved record as key/value pairs, in the order it arrived. */
const RecordFields = ({record}: {record: LibraryRecord}): React.JSX.Element => {
  const color = useColor();
  const entries = Object.entries(record).filter(
    ([, value]) => value !== null && value !== '',
  );
  const {t} = useTranslation();
  if (entries.length === 0) {
    return (
      <Text style={[styles.emptyRecord, {color: color.ham_text_secondary}]}>
        {t('app.library.booking_empty')}
      </Text>
    );
  }
  return (
    <>
      {entries.map(([key, value]) => (
        <View
          key={key}
          style={[styles.recordRow, {borderColor: color.ham_divider}]}>
          <Text style={[styles.recordKey, {color: color.ham_text_secondary}]}>
            {key}
          </Text>
          <Text style={[styles.recordValue, {color: color.ham_text_primary}]}>
            {typeof value === 'object' ? JSON.stringify(value) : `${value}`}
          </Text>
        </View>
      ))}
    </>
  );
};

const Rule = ({label, value}: {label: string; value: string}) => {
  const color = useColor();
  return (
    <View style={styles.rule}>
      <Text style={[styles.ruleValue, {color: color.ham_blue}]}>{value}</Text>
      <Text style={[styles.ruleLabel, {color: color.ham_text_secondary}]}>
        {label}
      </Text>
    </View>
  );
};

/**
 * Flattens the service's HTML notice to readable text.
 *
 * Block-level tags become newlines and everything else is dropped. It is a
 * presentation shortcut, not a parser: nothing here evaluates markup, and no
 * attribute is carried through, so a notice cannot smuggle anything into the
 * tree.
 */
const stripMarkup = (html: string): string =>
  html
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/\s*(p|div|li|tr|h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    gap: 12,
    padding: 16,
  },
  cardTitle: {
    fontSize: 16,
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
  emptyRecord: {
    fontSize: 14,
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
  notice: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
    padding: 16,
  },
  noticeBody: {
    fontSize: 13,
    lineHeight: 20,
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  recordKey: {
    flex: 1,
    fontSize: 12,
  },
  recordRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    paddingTop: 8,
  },
  recordValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
  },
  rule: {
    alignItems: 'center',
    flex: 1,
    gap: 3,
    minWidth: 88,
  },
  ruleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  ruleLabel: {
    fontSize: 11,
    textAlign: 'center',
  },
  ruleValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  screen: {
    flex: 1,
  },
  signing: {
    fontSize: 12,
    lineHeight: 18,
  },
});

export default LibraryScreen;
export {stripMarkup};
