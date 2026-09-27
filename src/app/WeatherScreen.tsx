import React, {useCallback, useEffect, useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import AppHeader from '@/app/components/AppHeader';
import StatusPanel from '@/app/components/StatusPanel';
import {getWeather} from '@/business/weather';
import type {WeatherDay, WeatherReport} from '@/business/weather';
import {describeError} from '@/utils/error';
import {useColor} from '@/utils/color/color';
import {weekdayOf} from '@/utils/date';
import PrimaryButton from '@/utils/ui/PrimaryButton';

/**
 * Campus weather.
 *
 * The only screen that needs no university session, so it is also the one that
 * proves the app is useful before anyone logs in.
 *
 * Detail rows are rendered conditionally rather than defaulted: the upstream
 * sends `null` for a variable it has no reading for, and printing "湿度 --%"
 * or "0%" would be a claim about the air that nobody measured. `formatNumber`
 * keeps the units out of the value so a missing reading disappears instead of
 * showing a bare number the reader has to interpret.
 */
const formatNumber = (value: number | undefined): string | undefined =>
  value === undefined ? undefined : `${value}`;

const WeatherScreen = ({onBack}: {onBack: () => void}): React.JSX.Element => {
  const color = useColor();
  const {t} = useTranslation();
  const [report, setReport] = useState<WeatherReport>();
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(undefined);
    try {
      setReport(await getWeather());
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows: Array<{key: string; label: string; value?: string}> = [];
  if (report) {
    const {current} = report;
    const apparent = formatNumber(current.apparentTemperature);
    if (apparent !== undefined) {
      rows.push({
        key: 'apparent',
        label: t('app.weather.feels_like'),
        value: t('app.weather.temperature_value', {value: apparent}),
      });
    }
    const humidity = formatNumber(current.humidity);
    if (humidity !== undefined) {
      rows.push({
        key: 'humidity',
        label: t('app.weather.humidity'),
        value: t('app.weather.percent_value', {value: humidity}),
      });
    }
    const wind = formatNumber(current.windSpeed);
    if (wind !== undefined) {
      rows.push({
        key: 'wind',
        label: t('app.weather.wind'),
        value: t('app.weather.speed_value', {value: wind}),
      });
    }
    const precipitation = formatNumber(current.precipitation);
    if (precipitation !== undefined) {
      rows.push({
        key: 'precipitation',
        label: t('app.weather.precipitation'),
        value: t('app.weather.millimetre_value', {value: precipitation}),
      });
    }
  }

  const renderDay = (day: WeatherDay, index: number) => {
    const weekday = weekdayOf(day.date);
    return (
      <View
        key={day.date}
        style={[
          styles.forecastRow,
          {
            backgroundColor: color.ham_bg_b2,
            borderColor: color.ham_divider,
          },
        ]}>
        <Text style={[styles.forecastDay, {color: color.ham_text_primary}]}>
          {index === 0
            ? t('app.weather.today')
            : weekday === undefined
              ? day.date
              : t(`app.weekday_${weekday}`)}
        </Text>
        <Text
          style={[styles.forecastCondition, {color: color.ham_text_secondary}]}>
          {t(`app.weather.condition_${day.condition}`)}
        </Text>
        <Text style={[styles.forecastRange, {color: color.ham_blue}]}>
          {t('app.weather.range_value', {
            max: day.temperatureMax,
            min: day.temperatureMin,
          })}
        </Text>
        {day.precipitationProbability === undefined ? null : (
          <Text
            style={[styles.forecastRain, {color: color.ham_text_secondary}]}>
            {t('app.weather.rain_chance', {
              value: day.precipitationProbability,
            })}
          </Text>
        )}
      </View>
    );
  };

  if (isLoading && !report) {
    return (
      <View style={[styles.screen, {backgroundColor: color.ham_bg_b1}]}>
        <AppHeader onBack={onBack} title={t('app.weather.title')} />
        <StatusPanel
          message={error}
          onAction={error ? () => void load() : undefined}
          retryLabel={t('app.retry')}
        />
      </View>
    );
  }

  return (
    <View style={[styles.screen, {backgroundColor: color.ham_bg_b1}]}>
      <AppHeader onBack={onBack} title={t('app.weather.title')} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.description, {color: color.ham_text_secondary}]}>
          {t('app.weather.description')}
        </Text>

        {report ? (
          <>
            <View
              style={[styles.nowCard, {backgroundColor: color.ham_lightBlue}]}>
              <Text
                style={[styles.nowCondition, {color: color.ham_text_primary}]}>
                {t(`app.weather.condition_${report.current.condition}`)}
              </Text>
              <Text
                style={[styles.nowTemperature, {color: color.ham_blue}]}
                testID="weather-temperature">
                {t('app.weather.temperature_value', {
                  value: report.current.temperature,
                })}
              </Text>
              <Text
                style={[styles.nowObserved, {color: color.ham_text_secondary}]}>
                {report.current.observedAt.replace('T', ' ')}
              </Text>
            </View>

            {rows.map(row => (
              <View
                key={row.key}
                style={[
                  styles.detailRow,
                  {
                    backgroundColor: color.ham_bg_b2,
                    borderColor: color.ham_divider,
                  },
                ]}>
                <Text
                  style={[
                    styles.detailLabel,
                    {color: color.ham_text_secondary},
                  ]}>
                  {row.label}
                </Text>
                <Text
                  style={[styles.detailValue, {color: color.ham_text_primary}]}>
                  {row.value}
                </Text>
              </View>
            ))}
          </>
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

        {report && report.daily.length > 0 ? (
          <View style={styles.forecastSection}>
            <Text
              style={[styles.forecastTitle, {color: color.ham_text_primary}]}>
              {t('app.weather.forecast')}
            </Text>
            {report.daily.map(renderDay)}
          </View>
        ) : null}

        <PrimaryButton
          accessibilityLabel={t('app.weather.refresh')}
          label={t('app.weather.refresh')}
          onPress={() => {
            void load();
          }}
        />

        <Text style={[styles.footnote, {color: color.ham_text_secondary}]}>
          {t('app.weather.source')}
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  content: {
    gap: 14,
    padding: 18,
    paddingBottom: 40,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  detailLabel: {
    fontSize: 14,
  },
  detailRow: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
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
  footnote: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  forecastCondition: {
    flex: 1,
    fontSize: 13,
  },
  forecastDay: {
    fontSize: 15,
    fontWeight: '600',
    minWidth: 64,
  },
  forecastRain: {
    fontSize: 12,
    minWidth: 56,
    textAlign: 'right',
  },
  forecastRange: {
    fontSize: 15,
    fontWeight: '600',
  },
  forecastRow: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  forecastSection: {
    gap: 9,
  },
  forecastTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  nowCard: {
    alignItems: 'center',
    borderRadius: 16,
    gap: 6,
    padding: 18,
  },
  nowCondition: {
    fontSize: 17,
    fontWeight: '600',
  },
  nowObserved: {
    fontSize: 12,
  },
  nowTemperature: {
    fontSize: 44,
    fontWeight: '700',
  },
  screen: {
    flex: 1,
  },
});

export default WeatherScreen;
