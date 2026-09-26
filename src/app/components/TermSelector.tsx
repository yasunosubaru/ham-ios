import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useColor} from '@/utils/color/color';

export interface AcademicTerm {
  semester: 1 | 2 | 3;
  year: number;
}

const TermSelector = ({
  onChange,
  term,
}: {
  onChange: (term: AcademicTerm) => void;
  term: AcademicTerm;
}): React.JSX.Element => {
  const color = useColor();
  const {t} = useTranslation();
  const semesters: Array<1 | 2 | 3> = [1, 2, 3];

  return (
    <View style={styles.container}>
      <Text style={[styles.label, {color: color.ham_text_secondary}]}>
        {t('app.term')}
      </Text>
      <View style={styles.row}>
        <Pressable
          accessibilityLabel={t('app.previous_year')}
          accessibilityRole="button"
          onPress={() => onChange({...term, year: term.year - 1})}
          style={({pressed}) => [
            styles.yearButton,
            {
              backgroundColor: color.ham_bg_b2,
              borderColor: color.ham_divider,
              opacity: pressed ? 0.65 : 1,
            },
          ]}>
          <Text style={[styles.yearButtonLabel, {color: color.ham_blue}]}>
            {t('app.previous_year')}
          </Text>
        </Pressable>
        <Text style={[styles.year, {color: color.ham_text_primary}]}>
          {term.year}
        </Text>
        <Pressable
          accessibilityLabel={t('app.next_year')}
          accessibilityRole="button"
          onPress={() => onChange({...term, year: term.year + 1})}
          style={({pressed}) => [
            styles.yearButton,
            {
              backgroundColor: color.ham_bg_b2,
              borderColor: color.ham_divider,
              opacity: pressed ? 0.65 : 1,
            },
          ]}>
          <Text style={[styles.yearButtonLabel, {color: color.ham_blue}]}>
            {t('app.next_year')}
          </Text>
        </Pressable>
      </View>
      <View style={styles.semesterRow}>
        {semesters.map(semester => {
          const selected = term.semester === semester;
          return (
            <Pressable
              accessibilityRole="button"
              key={semester}
              onPress={() => onChange({...term, semester})}
              style={({pressed}) => [
                styles.semesterButton,
                {
                  backgroundColor: selected ? color.ham_blue : color.ham_bg_b2,
                  borderColor: selected ? color.ham_blue : color.ham_divider,
                  opacity: pressed ? 0.65 : 1,
                },
              ]}>
              <Text
                style={[
                  styles.semesterLabel,
                  {
                    color: selected ? color.ham_bg_b2 : color.ham_text_primary,
                  },
                ]}>
                {t(`app.semester_${semester}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  semesterButton: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    paddingVertical: 10,
  },
  semesterLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  semesterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  year: {
    fontSize: 20,
    fontWeight: '700',
  },
  yearButton: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  yearButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default TermSelector;
