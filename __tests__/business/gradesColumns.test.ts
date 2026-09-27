import {
  COURSE_COLUMNS,
  FIELDS_WITHOUT_PAGE_LABEL,
  GRADE_QUERY_DO_TYPE,
  GRADE_QUERY_FIELDS,
  GRADE_QUERY_PATH,
  hasPageLabel,
  IDENTIFIER_FIELDS,
  labelOf,
  PAGE_LABEL,
  partitionRecord,
  ROSTER_COLUMNS,
  rowsOf,
  STUDENT_GRADE_QUERY_PATH,
  STUDENT_ZD_FZDM,
  TEACHER_ZD_FZDM,
  WHU_SCHOOL_CODE,
} from '@/business/education/grades/columns';

/**
 * A course row shaped after the page's own column definitions, using only fields
 * visible to a Wuhan University account (`sxxdm === '10486'`) or ungated.
 * `jsxx` is not among them: the grid has no role-based column split.
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
  xnmmc: '2025-2026',
  xqmmc: '1',
  jxb_id: '9001',
  key: 'abc',
  // Visible to Wuhan, but the page gives them no label of its own.
  kch_id: '7001',
  tdts: '2026-01-05',
  // Not in the vocabulary at all.
  sfbksrq: '2026-01-10',
  cjsr: '教务处',
};

const ROSTER_ROW = {
  xh: '2025302163204',
  xm: '某某',
  // No page label: it shows under its own name, not as a guess.
  bfzcj: '92',
  cj: '92',
  qmcj: '90',
  qzcj: '95',
  pscj: '94',
  yscj: '90',
  ysbfzcj: '90',
  xmblzbh: 'A001',
  cjsfzf: '0',
  tjrxm: '某某',
  tjsj: '2026-01-10 10:00',
  xh_id: '77',
  // A flag the page tests but never shows.
  sfkk: '0',
  // Not in the vocabulary.
  zsbh: 'Z001',
};

describe('the labels the page defines', () => {
  it('uses the label from the column definition', () => {
    // Not a reading of the field's name: the definition's own text.
    expect(labelOf('kcmc')).toBe('课程名称');
    expect(labelOf('kch')).toBe('课程代码');
    expect(labelOf('kkbmmc')).toBe('kkbmmc');
    expect(labelOf('tjsj')).toBe('提交时间');
  });

  it('says 学生标记 for xsbjmc, not 教材名称', () => {
    // A previous version read the field name and called it 教材名称. The page's
    // i18n dictionary says 学生标记, and 教材 would have been a plausible story
    // about a course row that the page never tells.
    expect(labelOf('xsbjmc')).toBe('学生标记');
    expect(labelOf('xsbjmc')).not.toBe('教材名称');
  });

  it('says 是否成绩作废 for cjsfzf, not 是否加分', () => {
    // Same mistake, opposite direction: the field looks like sfjf (是否加分) and
    // its i18n key is sfcjzf. The page resolves it to 是否成绩作废.
    expect(labelOf('cjsfzf')).toBe('是否成绩作废');
    expect(labelOf('sfjfmc')).toBe('成绩是否加分');
  });

  it('shows a field the page leaves unnamed under its own name', () => {
    // bfzcj is what the page compares against 60 and 100 when colouring a row,
    // and it never says what it means. "总评成绩" would read well and be a guess.
    expect(labelOf('bfzcj')).toBe('bfzcj');
    expect(hasPageLabel('bfzcj')).toBe(false);
    expect(FIELDS_WITHOUT_PAGE_LABEL.has('bfzcj')).toBe(true);
  });

  it('tells a page label apart from a bare field name', () => {
    // The screen needs the difference: one is the university's word, the other
    // is ours because it had none to give.
    expect(hasPageLabel('kcmc')).toBe(true);
    expect(hasPageLabel('bfzcj')).toBe(false);
  });

  it('keeps the two branch-dependent labels apart', () => {
    // sfxwkc reads 是否学位课程 in the general branch and 主要课程 under
    // sxxdm == '13613'. Wuhan is 10486, so it is the former -- but the
    // dictionary carries both, and only the school code tells them apart.
    expect(PAGE_LABEL['sfxwkc']).toBeUndefined();
    expect(labelOf('sfxwkc')).toBe('sfxwkc');
  });

  it('has no field listed as both labelled and unlabelled', () => {
    for (const name of Object.keys(PAGE_LABEL)) {
      expect(FIELDS_WITHOUT_PAGE_LABEL.has(name)).toBe(false);
    }
  });

  it('resolves a school code, so the vocabulary says which one it is for', () => {
    expect(WHU_SCHOOL_CODE).toBe('10486');
  });
});

describe('rowsOf', () => {
  it('reads the measured envelope', () => {
    // The score parser reads `items` off this host's replies, so that is the one
    // shape actually observed. The others are fallbacks, not claims.
    expect(rowsOf({items: [{a: 1}, {a: 2}]})).toEqual([{a: 1}, {a: 2}]);
  });

  it('accepts a bare array', () => {
    expect(rowsOf([{a: 1}])).toEqual([{a: 1}]);
  });

  it('finds an array under a key it does not name', () => {
    // A jqGrid wrapper would answer {rows: [...], total: n}; an object keyed by
    // course would answer {MATH101: [...]}. The fallback catches both without
    // committing to a key name the page never showed.
    expect(rowsOf({rows: [{a: 1}], total: 1})).toEqual([{a: 1}]);
    expect(rowsOf({MATH101: [{a: 1}]})).toEqual([{a: 1}]);
  });

  it('does not flatten rows that are not arrays', () => {
    // Nesting a structure into invented field names is the thing this module
    // exists to avoid, so such a reply is shown raw instead.
    expect(rowsOf({courses: {MATH101: {xh: '1'}}})).toEqual([]);
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

  it('does not invent rows out of an object keyed by course', () => {
    // Reading the nested shape would mean naming fields the page never showed.
    // The array fallback covers it incidentally; a non-array nesting does not.
    expect(rowsOf({MATH101: {xh: '1'}})).toEqual([]);
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
      'xnmmc',
      'xqmmc',
      'jxb_id',
    ]);
  });

  it('reports the fields it does not know, rather than dropping them', () => {
    // A field outside the vocabulary is a fact about the reply. Hiding it would
    // make the screen look complete when it is not.
    expect(rest.map(f => f.name).sort()).toEqual([
      'cjsr',
      'kch_id',
      'sfbksrq',
      'tdts',
    ]);
  });

  it('does not show a grid key as a row of the table', () => {
    expect(known.map(f => f.name)).not.toContain('key');
    expect(rest.map(f => f.name)).not.toContain('key');
    expect(IDENTIFIER_FIELDS.has('key')).toBe(true);
  });
});

describe('partitionRecord on a roster row', () => {
  const {known, rest} = partitionRecord(ROSTER_ROW, ROSTER_COLUMNS);

  it('reads the mark columns in the order that matters', () => {
    // Identity, then the mark, then what it was made of, then the audit trail.
    expect(known.map(f => f.name)).toEqual([
      'xh',
      'xm',
      'bfzcj',
      'cj',
      'yscj',
      'ysbfzcj',
      'qmcj',
      'qzcj',
      'pscj',
      'xmblzbh',
      'cjsfzf',
      'tjrxm',
      'tjsj',
      'xh_id',
    ]);
  });

  it('leads the marks with the field the page itself decides rows by', () => {
    // bfzcj is what loadComplete compares against 60 and 100. It has no label,
    // and it is still the first mark shown.
    expect(known.map(f => f.name).indexOf('bfzcj')).toBe(
      known.map(f => f.name).indexOf('xh') + 2,
    );
    expect(known.find(f => f.name === 'bfzcj')?.label).toBe('bfzcj');
  });

  it('skips a sub-score the service did not fill in', () => {
    // The real reply omits absent sub-scores rather than sending them blank.
    // Printing an empty cell beside a filled one invites reading the two as
    // different, so an absence stays an absence.
    expect(known.map(f => f.name)).not.toContain('sycj');
    expect(known.map(f => f.name)).not.toContain('bzxx');
  });

  it('hides the flags the page tests but never shows', () => {
    expect(known.map(f => f.name)).not.toContain('sfkk');
    expect(rest.map(f => f.name)).not.toContain('sfkk');
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

describe('the query contract', () => {
  it('points a teacher query at the page the app already drives', () => {
    // The grid posts to its own Action, branched on the hidden jsxx field:
    //   url: _path + (jsxx == "xs" ? '/cjcx/cjcx_cxXsgrcj.html'
    //                              : '/cjcx/cjcx_cxDgXscj.html') + '?doType=query'
    // So a teacher's grade query is the same page, querying itself. This is the
    // first time the endpoint has been known rather than assumed.
    expect(GRADE_QUERY_PATH).toBe('/cjcx/cjcx_cxDgXscj.html');
    expect(GRADE_QUERY_DO_TYPE).toBe('query');
    expect(STUDENT_GRADE_QUERY_PATH).toBe('/cjcx/cjcx_cxXsgrcj.html');
  });

  it('sends the role as the suffix the grid declares', () => {
    // remoteParams: {zd_fzdm: jsxx == 'xs' ? "N305005-xs" : "N305005-gly"}
    expect(TEACHER_ZD_FZDM).toBe('N305005-gly');
    expect(STUDENT_ZD_FZDM).toBe('N305005-xs');
  });

  it('carries the query body paramMap() actually sends', () => {
    // 44 fields, in source order, so this is the page's contract rather than a
    // shape of someone's imagination.
    expect(GRADE_QUERY_FIELDS).toHaveLength(44);
    expect(new Set(GRADE_QUERY_FIELDS).size).toBe(44);
    expect(GRADE_QUERY_FIELDS[0]).toBe('xhxm');
    expect(GRADE_QUERY_FIELDS).toContain('pkey');
    expect(GRADE_QUERY_FIELDS).toContain('cxbkjgcj');
  });

  it('never sends a credential as a query field', () => {
    // The body is a filter form. If a password or a session token ever shows up
    // in this list, something has gone wrong in reading the page.
    for (const field of GRADE_QUERY_FIELDS) {
      expect(field).not.toMatch(/mm|pwd|pass|token|cookie|ticket|zsjh/i);
    }
  });
});
