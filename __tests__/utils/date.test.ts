import {weekdayOf} from '@/utils/date';

describe('weekdayOf', () => {
  it('reads the weekday off the dates the forecast actually sends', () => {
    // The four dates in the captured Open-Meteo response, so a change in how
    // they are turned into labels is caught against real input.
    expect(weekdayOf('2026-09-27')).toBe(0);
    expect(weekdayOf('2026-09-28')).toBe(1);
    expect(weekdayOf('2026-09-29')).toBe(2);
    expect(weekdayOf('2026-09-30')).toBe(3);
  });

  it('does not shift the day for a negative UTC offset', () => {
    // `new Date('2026-09-27')` is UTC midnight, so any local-time getter
    // west of Greenwich reads 2026-09-26 back out of it. Anchoring to UTC is
    // what keeps a forecast row from being labelled with yesterday.
    const midnight = Date.parse('2026-09-27T00:00:00Z');
    expect(new Date(midnight).getUTCDate()).toBe(27);
    expect(weekdayOf('2026-09-27')).toBe(new Date(midnight).getUTCDay());
  });

  it('handles the first and last day of a year', () => {
    expect(weekdayOf('2026-01-01')).toBe(4);
    expect(weekdayOf('2026-12-31')).toBe(4);
  });

  it('handles a leap day', () => {
    expect(weekdayOf('2028-02-29')).toBe(2);
  });

  it('rejects anything that is not a plain calendar date', () => {
    expect(weekdayOf('2026-09-27T00:15')).toBeUndefined();
    expect(weekdayOf('2026-9-7')).toBeUndefined();
    expect(weekdayOf('27/09/2026')).toBeUndefined();
    expect(weekdayOf('')).toBeUndefined();
  });

  it('rejects a date the calendar does not have', () => {
    // Date.UTC rolls these over into the next month, so the round trip is the
    // only thing that catches them.
    expect(weekdayOf('2026-02-30')).toBeUndefined();
    expect(weekdayOf('2026-13-01')).toBeUndefined();
    expect(weekdayOf('2027-02-29')).toBeUndefined();
  });
});
