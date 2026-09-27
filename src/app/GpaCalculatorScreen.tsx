import React, {useMemo, useRef, useState} from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import AppHeader from '@/app/components/AppHeader';
import PrimaryButton from '@/utils/ui/PrimaryButton';
import {useColor} from '@/utils/color/color';

interface CalculatorItem {
  credit: string;
  id: number;
  name: string;
  score: string;
}

const GpaCalculatorScreen = ({
  onBack,
}: {
  onBack: () => void;
}): React.JSX.Element => {
  const color = useColor();
  const {t} = useTranslation();
  const nextId = useRef(2);
  const [items, setItems] = useState<CalculatorItem[]>([
    {credit: '', id: 1, name: '', score: ''},
  ]);

  const updateItem = (
    id: number,
    field: 'credit' | 'name' | 'score',
    value: string,
  ): void => {
    setItems(current =>
      current.map(item => (item.id === id ? {...item, [field]: value} : item)),
    );
  };

  const summary = useMemo(() => {
    const valid = items
      .map(item => ({
        credit: Number.parseFloat(item.credit),
        score: Number.parseFloat(item.score),
      }))
      .filter(
        item =>
          Number.isFinite(item.credit) &&
          Number.isFinite(item.score) &&
          item.credit > 0 &&
          item.score >= 0 &&
          item.score <= 100,
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
  }, [items]);

  return (
    <View style={[styles.screen, {backgroundColor: color.ham_bg_b1}]}>
      <AppHeader onBack={onBack} title={t('app.calculator.title')} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.description, {color: color.ham_text_secondary}]}>
          {t('app.calculator.description')}
        </Text>

        <View style={styles.itemList}>
          {items.map((item, index) => (
            <View
              key={item.id}
              style={[
                styles.itemCard,
                {
                  backgroundColor: color.ham_bg_b2,
                  borderColor: color.ham_divider,
                },
              ]}>
              <View style={styles.itemHeader}>
                <Text
                  style={[styles.itemTitle, {color: color.ham_text_primary}]}>
                  {t('app.calculator.course_number', {number: index + 1})}
                </Text>
                {items.length > 1 ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setItems(current =>
                        current.filter(
                          currentItem => currentItem.id !== item.id,
                        ),
                      );
                    }}
                    style={({pressed}) => [
                      styles.removeButton,
                      {opacity: pressed ? 0.5 : 1},
                    ]}>
                    <Text style={[styles.removeLabel, {color: color.ham_red}]}>
                      {t('app.calculator.remove')}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              <TextInput
                accessibilityLabel="calculator-course-name"
                testID="calculator-course-name"
                onChangeText={value => updateItem(item.id, 'name', value)}
                placeholder={t('app.calculator.course_name')}
                placeholderTextColor={color.ham_text_secondary}
                style={[
                  styles.input,
                  {
                    borderColor: color.ham_divider,
                    color: color.ham_text_primary,
                  },
                ]}
                value={item.name}
              />
              <View style={styles.inputRow}>
                <View style={styles.inputColumn}>
                  <Text
                    style={[
                      styles.inputLabel,
                      {color: color.ham_text_secondary},
                    ]}>
                    {t('app.calculator.credit')}
                  </Text>
                  <TextInput
                    accessibilityLabel={t('app.calculator.credit')}
                    keyboardType="decimal-pad"
                    onChangeText={value => updateItem(item.id, 'credit', value)}
                    placeholder="0.0"
                    placeholderTextColor={color.ham_text_secondary}
                    style={[
                      styles.input,
                      styles.numberInput,
                      {
                        borderColor: color.ham_divider,
                        color: color.ham_text_primary,
                      },
                    ]}
                    value={item.credit}
                  />
                </View>
                <View style={styles.inputColumn}>
                  <Text
                    style={[
                      styles.inputLabel,
                      {color: color.ham_text_secondary},
                    ]}>
                    {t('app.calculator.score')}
                  </Text>
                  <TextInput
                    accessibilityLabel={t('app.calculator.score')}
                    keyboardType="decimal-pad"
                    onChangeText={value => updateItem(item.id, 'score', value)}
                    placeholder="0"
                    placeholderTextColor={color.ham_text_secondary}
                    style={[
                      styles.input,
                      styles.numberInput,
                      {
                        borderColor: color.ham_divider,
                        color: color.ham_text_primary,
                      },
                    ]}
                    value={item.score}
                  />
                </View>
              </View>
            </View>
          ))}
        </View>

        <PrimaryButton
          accessibilityLabel="calculator-add-course"
          label={t('app.calculator.add_course')}
          testID="calculator-add-course"
          onPress={() => {
            const id = nextId.current;
            nextId.current += 1;
            setItems(current => [
              ...current,
              {credit: '', id, name: '', score: ''},
            ]);
          }}
        />

        <View
          style={[styles.summaryCard, {backgroundColor: color.ham_lightBlue}]}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, {color: color.ham_blue}]}>
              {summary.average.toFixed(2)}
            </Text>
            <Text
              style={[styles.summaryLabel, {color: color.ham_text_secondary}]}>
              {t('app.calculator.weighted_average')}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, {color: color.ham_blue}]}>
              {summary.credits.toFixed(1)}
            </Text>
            <Text
              style={[styles.summaryLabel, {color: color.ham_text_secondary}]}>
              {t('app.calculator.total_credit')}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, {color: color.ham_blue}]}>
              {summary.count}
            </Text>
            <Text
              style={[styles.summaryLabel, {color: color.ham_text_secondary}]}>
              {t('app.calculator.valid_courses')}
            </Text>
          </View>
        </View>
        <Text style={[styles.disclaimer, {color: color.ham_text_secondary}]}>
          {t('app.calculator.disclaimer')}
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  content: {
    gap: 18,
    padding: 18,
    paddingBottom: 40,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  disclaimer: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  input: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputColumn: {
    flex: 1,
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  itemCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
    padding: 14,
  },
  itemHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemList: {
    gap: 10,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  numberInput: {
    textAlign: 'center',
  },
  removeButton: {
    padding: 6,
  },
  removeLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  screen: {
    flex: 1,
  },
  summaryCard: {
    borderRadius: 16,
    flexDirection: 'row',
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
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
  },
});

export default GpaCalculatorScreen;
