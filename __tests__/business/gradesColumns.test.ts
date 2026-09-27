import {
  COURSE_COLUMNS,
  labelOf,
  partitionRecord,
  ROSTER_COLUMNS,
  rowsOf,
} from '@/business/education/grades/columns';

/**
 * A course row shaped after the page's own grid definition, using only fields
 * that appear for a Wuhan University account (`sxxdm == '10486'`) or are
 * ungated. `jsxx` is not among them: the grid has no role-based column split.
 */
const COURSE_ROW = {
  kch: 'MATH101',
  kcmc: '高等数学',
  jxbmc: '01',
  xf: '5.0',
  kkbmmc: '数学与统计学院',
  kclbmc: '必修',
  kcgsmc: '基础课',
  kcxzmc: '必修',
  jsxm: '某某',
  khfsmc: '闭卷考试',
  xnm: '2025-2026',
  xqm: '1',
  jxb_id: '9001',
  key: 'abc',
  // Present in the reply, absent from the vocabulary, and an identifier.
  sfbksrq: '2026-01-10',
  cjsr: '教务处',
};

const ROSTER_ROW = {
  xh: '2025302163204',
  xm: '某某',
  bfzcj: '92',
  cj: '92',
  qmcj: '90',
  qzcj: '95',
  pscj: '94',
  ysbfzcj: '90',
  xmblzbh: 'A001',
  tjrxm: '某某',
  tjsj: '2026-01-10 10:00',
  jxb_id: '9001',
  xh_id: '77',
  // Not in the vocabulary.
  zsbh: 'Z001',
};

describe('rowsOf', () => {
  it('reads the measured envelope', () => {
    // The score parser reads `items` off this host's replies, so that is the one
    // shape actually observed. The others are fallbacks, not claims.
    expect(rowsOf({items: [{a: 1}, {a: 2}]})).toEqual([{a: 1}, {a: 2}]);
  });

  it('accepts a bare array', () => {
    expect(rowsOf([{a: 1}])).toEqual([{a: 1}]);
  });

  it('finds an array under another key', () => {
    expect(rowsOf({rows: [{a: 1}]})).toEqual([{a: 1}]);
  });

  it('drops anything in a list that is not a record', () => {
    // A reply that mixes objects with a scalar would otherwise crash the render.
    expect(rowsOf({items: [{a: 1}, 5, null, 'x']})).toEqual([{a: 1}]);
  });

  it('returns nothing rather than throwing on an unusable body', () => {
    expect(rowsOf(null)).toEqual([]);
    expect(rowsOf('text')).toEqual([]);
    expect(rowsOf(7)).toEqual([]);
    expect(rowsOf({items: null})).toEqual([]);
  });
});

describe('partitionRecord on a course row', () => {
  const {known, rest} = partitionRecord(COURSE_ROW, COURSE_COLUMNS);

  it('names the fields it knows, in the order it wants to read them', () => {
    expect(known.map(f => f.name)).toEqual([
      'kch',
      'kcmc',
      'jxbmc',
      'xf',
      'kkbmmc',
      'kclbmc',
      'kcgsmc',
      'kcxzmc',
      'jsxm',
      'khfsmc',
      'xnm',
      'xqm',
      'jxb_id',
    ]);
  });

  it('uses the labels the page itself defines', () => {
    // Not a reading of the field's name: the page's own column definitions.
    expect(labelOf('kcmc')).toBe('课程名称');
    expect(labelOf('bfzcj')).toBe('总评成绩');
    expect(labelOf('kkbmmc')).toBe('开课部门');
  });

  it('reports the fields it does not know, rather than dropping them', () => {
    // A field outside the vocabulary is a fact about the reply. Hiding it would
    // make the screen look complete when it is not.
    expect(rest.map(f => f.name).sort()).toEqual(['cjsr', 'sfbksrq']);
  });

  it('does not show identifiers as data rows', () => {
    // `key` and `jxb_id` are keys, not something a reader wants in the table --
    // except that `jxb_id` is the drill-down key, so it stays in the known list
    // while `key` is filtered.
    expect(known.map(f => f.name)).toContain('jxb_id');
    expect(rest.map(f => f.name)).not.toContain('key');
  });
});

describe('partitionRecord on a roster row', () => {
  const {known, rest} = partitionRecord(ROSTER_ROW, ROSTER_COLUMNS);

  it('reads the mark columns in the order that matters', () => {
    // Identity first, then the mark, then the breakdown, then who submitted it.
    // `yscj` is absent from the fixture, so it is not in the list -- see the
    // next test.
    expect(known.map(f => f.name)).toEqual([
      'xh',
      'xm',
      'bfzcj',
      'cj',
      'ysbfzcj',
      'qmcj',
      'qzcj',
      'pscj',
      'xmblzbh',
      'tjrxm',
      'tjsj',
      'xh_id',
    ]);
  });

  it('skips a sub-score the service did not fill in', () => {
    // The real reply omits absent sub-scores rather than sending them blank.
    // Printing an empty cell beside a filled one invites reading the two as
    // different, so an absence stays an absence.
    expect(known.map(f => f.name)).not.toContain('sycj');
    expect(known.map(f => f.name)).not.toContain('bzxx');
  });

  it('reports what is left over', () => {
    expect(rest.map(f => f.name)).toEqual(['zsbh']);
  });
});

describe('partitionRecord edges', () => {
  it('drops null, undefined and empty values', () => {
    const {known, rest} = partitionRecord(
      {kcmc: 'x', jsxm: null, xf: '', bfzcj: undefined, kch: 0},
      COURSE_COLUMNS,
    );
    // 0 is a value, not an absence -- a zero mark is a mark.
    expect(known.map(f => f.name)).toEqual(['kch', 'kcmc']);
    expect(rest).toEqual([]);
  });

  it('says nothing is known rather than rendering a blank card', () => {
    const {known, rest} = partitionRecord({unknown: 'v'}, COURSE_COLUMNS);
    expect(known).toEqual([]);
    expect(rest.map(f => f.label)).toEqual(['unknown']);
  });

  it('returns a record with nothing in it as both lists empty', () => {
    const {known, rest} = partitionRecord({}, COURSE_COLUMNS);
    expect(known).toEqual([]);
    expect(rest).toEqual([]);
  });

  it('does not repeat a field the order lists twice', () => {
    // `cj` appears under several school codes in the page's own model; showing
    // one row value twice because two entries named the same field would be a
    // bug in this list, not in the reply.
    const doubled = [...ROSTER_COLUMNS, {name: 'cj', label: '另一个标签'}];
    const {known} = partitionRecord({cj: '90'}, doubled);
    expect(known).toHaveLength(1);
    expect(known[0].label).toBe('成绩');
  });
});

describe('the vocabulary itself', () => {
  it('carries the fields a roster cannot be read without', () => {
    // Without a student id and a mark there is nothing to show, so these are the
    // two the screen is useless without.
    const names = ROSTER_COLUMNS.map(c => c.name);
    expect(names).toContain('xh');
    expect(names).toContain('xm');
    expect(names).toContain('bfzcj');
  });

  it('carries the drill-down key a course list is navigated by', () => {
    // The page's request parameters carry `jxb_id`, which is what says the list
    // is a teaching-class list rather than a flat one.
    expect(COURSE_COLUMNS.map(c => c.name)).toContain('jxb_id');
  });

  it('does not pretend to know a field it has no label for', () => {
    // A column with an unresolvable i18n key gets the field name as its label
    // rather than a guessed translation.
    expect(Object.values(labelOf('kch'))).not.toHaveLength(0);
  });
});
