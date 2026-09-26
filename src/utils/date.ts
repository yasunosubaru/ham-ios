/**
 * Weekday for a `YYYY-MM-DD` date string, as 0 (Sunday) through 6 (Saturday).
 *
 * The date is anchored to UTC rather than parsed as local midnight, and that is
 * the whole point of the function. `new Date('2026-09-27')` is specified as
 * UTC midnight, so formatting it with the device's local getters reads back
 * 2026-09-26 for any negative UTC offset — the forecast row ends up labelled
 * with yesterday. `Date.UTC` plus `getUTCDay` has no such shift: the weekday
 * of a calendar date is the same everywhere.
 *
 * Returns `undefined` for anything that is not a real calendar date, so a
 * caller renders nothing rather than an invented day.
 */
const weekdayOf = (dateOnly: string): number | undefined => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
  if (!match) {
    return undefined;
  }
  const [year, month, day] = match.slice(1).map(Number);
  const stamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(stamp);
  // Date.UTC rolls 2026-02-30 over into March, so a round trip is the check.
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return undefined;
  }
  return parsed.getUTCDay();
};

export {weekdayOf};
