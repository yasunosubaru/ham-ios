/**
 * The education system's grade vocabulary, read out of the page's own code.
 *
 * ## Where this comes from
 *
 * `/js/comp/jwglxt/cjgl/cjcx/cxDgXscj.js` is the script behind the grade grid.
 * It pushes 108 column definitions across 48 `colModelArr.push(...)` calls, and
 * every label is either a Chinese literal in the definition or an
 * `$.i18n.get("key")` whose key is resolved by a comment on the same line --
 * the source carries its own dictionary, so nothing here needed to be guessed at
 * or translated.
 *
 * ## What the grid is actually keyed on
 *
 * Not the role. One `jsxx` test wraps the first stretch of `getGridColModel()`
 * and there is no `else`; which columns appear is decided by the **school code**
 * `sxxdm`. A Wuhan University account is `10486`, so the visible set is the
 * ungated columns plus those gated on `10486` or on `!= <some other school>`.
 * 73 fields qualify.
 *
 * That distinction is not cosmetic. A field's label can differ between branches:
 * `sfxwkc` is 是否学位课程 in the general branch and 主要课程 under
 * `sxxdm == '13613'`, and only one of those is what Wuhan sees. Resolving
 * labels globally picks the wrong one about half the time.
 *
 * ## Labels this module refuses to invent
 *
 * 16 of the 73 visible fields carry no label of their own -- `bfzcj` among
 * them, which is the field the page itself tests against 60 and 100 when it
 * colours a row. Its name is shown instead. That is deliberate: `bfzcj` is
 * almost certainly the final mark, and "总评成绩" would read well, but the page
 * does not say so anywhere, and a plausible label is how a guess becomes a
 * contract. The same goes for `ksxzdm` and `sfjf`, where a neighbouring column
 * *is* labelled and invites the wrong pairing.
 *
 * {@link labelOf} therefore returns the field's own name for those, and
 * {@link hasPageLabel} lets a caller tell "the page calls this 总评成绩" apart
 * from "this is the raw field name".
 */

/** Wuhan University's school code, the `sxxdm` this vocabulary is resolved for. */
const WHU_SCHOOL_CODE = '10486';

/**
 * The grade query's endpoint, and the one fact about it that is not a guess.
 *
 * Both roles post to the same Action, branched server-side by the hidden `jsxx`
 * field:
 *
 *     url: _path + ($("#jsxx").val() == "xs" ? '/cjcx/cjcx_cxXsgrcj.html'
 *                                               : '/cjcx/cjcx_cxDgXscj.html')
 *            + '?doType=query'
 *
 * so a teacher account's grade query is `POST /cjcx/cjcx_cxDgXscj.html?doType=query`
 * -- the same page the app already drives, querying itself. The body is
 * `paramMap()`; see {@link GRADE_QUERY_FIELDS}.
 */
const GRADE_QUERY_PATH = '/cjcx/cjcx_cxDgXscj.html';
const GRADE_QUERY_DO_TYPE = 'query';

/** The student's counterpart, for the same Action and the other role. */
const STUDENT_GRADE_QUERY_PATH = '/cjcx/cjcx_cxXsgrcj.html';

/**
 * `remoteParams` on the grid, which pairs with the role branch above.
 *
 * `N305005-gly` for a teacher, `N305005-xs` for a student. The same `gnmkdm`
 * serves both; only this suffix differs.
 */
const TEACHER_ZD_FZDM = 'N305005-gly';
const STUDENT_ZD_FZDM = 'N305005-xs';

/**
 * The 44 fields `paramMap()` puts in the query body, in source order.
 *
 * Recorded because it is the difference between "we guessed the parameters" and
 * "these are the parameters the page sends". Two of them, `cxbkjgcj` and
 * `validate`, are controls rather than filters; the rest are the query form.
 * Which of them carry a value depends on what the user filled in, and the page
 * sends them all regardless -- empty string included.
 *
 * Nothing in this app builds this body. It is here so the screen's copy can be
 * specific about what a grade query is, and so a future direct call would start
 * from the real contract rather than from a shape of someone's imagination.
 */
const GRADE_QUERY_FIELDS = [
  'xhxm',
  'kkxb_id',
  'kkbm_id',
  'cxcykclxdm',
  'kclbdm',
  'kch',
  'cjbzdm',
  'xqh_id',
  'njdm',
  'zyh_id',
  'x_id',
  'tyxm_id',
  'bjdm',
  'kcxzdm',
  'kcgsdm',
  'xb_id',
  'jg_id_cx',
  'zt',
  'ccdm',
  'xslb',
  'xz',
  'zyfx_id',
  'cjxzm',
  'xsbj',
  'cjsfzfbj',
  'xxdm',
  'sfjf',
  'drcx_id',
  'xmblzbh',
  'xmblbz',
  'bzkzym',
  'sfzx',
  'ywxj',
  'sfbkkc',
  'zsxy_id',
  'kklxdm',
  'jsxm',
  'sfzgcj',
  'cxbkjgcj',
  'validate',
  'kcsfwtg',
  'kccjpmfs',
  'kcbj',
  'pkey',
] as const;

/**
 * The label the page gives a field, for a Wuhan University account.
 *
 * Machine-copied out of the script's column definitions rather than retyped,
 * after evaluating the `sxxdm` gates for `10486`. 57 of the 73 visible fields.
 */
const PAGE_LABEL: Record<string, string> = {
  bzxx: '备注信息',
  cj: '成绩',
  cjbdczr: '录入人',
  cjbdsj: '录入时间',
  cjbz: '成绩备注',
  cjsfzf: '是否成绩作废',
  ck: '查看',
  cxcykclxmc: '创新创业课程类型',
  czr: '成绩录入教师',
  jd: '绩点',
  jsxm: '任课教师',
  jxb_id: '教学班ID',
  jxbmc: '教学班',
  jybkcj: '卷一补考成绩',
  jycj: '卷一成绩',
  kcbj: '课程标记',
  kccjpm: '名次',
  kcgsmc: '课程归属',
  kch: '课程代码',
  kclbmc: '课程类别',
  kcmc: '课程名称',
  kcxzmc: '课程性质',
  khfsmc: '考核方式',
  kklxdm: '开课类型',
  ksxz: '成绩性质',
  pscj: '平时',
  qmblzh: '期末成绩',
  qmcj: '期末',
  qzcj: '期中',
  rwzxs: '学时',
  sfdkbcx: '单开班重修',
  sfjfmc: '成绩是否加分',
  sfzh: '身份证号',
  sfzx: '是否在校',
  sqmc: '书社名称',
  ssfdyjghxm: '辅导员[工号/姓名]',
  sskcmc: '所属课程',
  sycj: '实验',
  symc: '书院名称',
  tjrxm: '提交人',
  tjsj: '提交时间',
  wlkkxq: '未来开课学期',
  xf: '学分',
  xfjd: '学分绩点',
  xh: '学号',
  xm: '姓名',
  xmblbz: '项目比例备注',
  xmblzbh: '成绩分项比例编号',
  xmcjbz: '项目成绩',
  xnmmc: '学年',
  xqmmc: '学期',
  xsbjmc: '学生标记',
  xydsjghxm: '学业导师[工号/姓名]',
  ysbfzcj: '加分前百分制成绩',
  yscj: '加分前成绩',
  zsxymc: '招生学院',
  zxs: '学时',
};

/**
 * The fields the page defines for Wuhan that carry no label of its own.
 *
 * Listed so the fact is recorded rather than inferred at runtime, and so
 * `hasPageLabel` has something to consult that is not a negative lookup.
 */
const FIELDS_WITHOUT_PAGE_LABEL = new Set([
  'bfzcj',
  'cjfxzh',
  'jysmc',
  'kch_id',
  'key',
  'kkbmmc',
  'ksxzdm',
  'sfcxkkxq',
  'sfjf',
  'sfkk',
  'sfxsts',
  'sfxwkc',
  'tdts',
  'xh_id',
  'xnm',
  'xqm',
]);

/** What to call a field: the page's label, or the field's own name. */
const labelOf = (name: string): string => PAGE_LABEL[name] ?? name;

/**
 * Whether the page names this field at all.
 *
 * The screen uses it to say so, rather than passing off a raw field name as
 * though the university had named it that way.
 */
const hasPageLabel = (name: string): boolean => name in PAGE_LABEL;

/** A column in reading order: the field, and what to call it. */
interface Column {
  /** What the screen calls it. Falls back to the field name; see {@link labelOf}. */
  label: string;
  /** The payload field, which is the only part that matters to a client. */
  name: string;
}

/**
 * Course-level columns, in the order a course list is most usefully read.
 *
 * A *decision*, and labelled as one: the page defines these columns in whatever
 * order the school code produces, and no ordering is more correct than another.
 * Identity, then the course's own attributes, then the term it belongs to.
 *
 * `jxb_id` is here because the request carries it -- the grid's `postData` and
 * several dialogs' `data` both take `jxb_id`, `xh_id` or `kch_id` -- which is
 * what says a row is a teaching class with things hanging off it.
 */
const COURSE_COLUMNS: Column[] = [
  {name: 'kch', label: labelOf('kch')},
  {name: 'kcmc', label: labelOf('kcmc')},
  {name: 'jxbmc', label: labelOf('jxbmc')},
  {name: 'cjbdczr', label: labelOf('cjbdczr')},
  {name: 'czr', label: labelOf('czr')},
  {name: 'cjbdsj', label: labelOf('cjbdsj')},
  {name: 'xf', label: labelOf('xf')},
  {name: 'kkbmmc', label: labelOf('kkbmmc')},
  {name: 'kclbmc', label: labelOf('kclbmc')},
  {name: 'kcgsmc', label: labelOf('kcgsmc')},
  {name: 'kcxzmc', label: labelOf('kcxzmc')},
  {name: 'kklxdm', label: labelOf('kklxdm')},
  {name: 'jsxm', label: labelOf('jsxm')},
  {name: 'khfsmc', label: labelOf('khfsmc')},
  {name: 'kcbj', label: labelOf('kcbj')},
  {name: 'sfdkbcx', label: labelOf('sfdkbcx')},
  {name: 'sfxwkc', label: labelOf('sfxwkc')},
  {name: 'wlkkxq', label: labelOf('wlkkxq')},
  {name: 'cxcykclxmc', label: labelOf('cxcykclxmc')},
  {name: 'xnmmc', label: labelOf('xnmmc')},
  {name: 'xqmmc', label: labelOf('xqmmc')},
  {name: 'jxb_id', label: labelOf('jxb_id')},
];

/**
 * Mark-level columns, in the order a roster is most usefully read.
 *
 * Identity, the mark, what it was made of, then the audit trail. `bfzcj` leads
 * the marks because the page itself treats it as the one that decides a row's
 * fate -- it is what it compares against 60 and against 100 when colouring rows
 * -- but it has no label, so it shows under its own name.
 */
const ROSTER_COLUMNS: Column[] = [
  {name: 'xh', label: labelOf('xh')},
  {name: 'xm', label: labelOf('xm')},
  {name: 'sfzh', label: labelOf('sfzh')},
  {name: 'bfzcj', label: labelOf('bfzcj')},
  {name: 'cj', label: labelOf('cj')},
  {name: 'yscj', label: labelOf('yscj')},
  {name: 'ysbfzcj', label: labelOf('ysbfzcj')},
  {name: 'qmcj', label: labelOf('qmcj')},
  {name: 'qzcj', label: labelOf('qzcj')},
  {name: 'pscj', label: labelOf('pscj')},
  {name: 'sycj', label: labelOf('sycj')},
  {name: 'qmblzh', label: labelOf('qmblzh')},
  {name: 'xmblzbh', label: labelOf('xmblzbh')},
  {name: 'xmblbz', label: labelOf('xmblbz')},
  {name: 'xmcjbz', label: labelOf('xmcjbz')},
  {name: 'cjsfzf', label: labelOf('cjsfzf')},
  {name: 'sfjfmc', label: labelOf('sfjfmc')},
  {name: 'cjbz', label: labelOf('cjbz')},
  {name: 'bzxx', label: labelOf('bzxx')},
  {name: 'jycj', label: labelOf('jycj')},
  {name: 'jybkcj', label: labelOf('jybkcj')},
  {name: 'kccjpm', label: labelOf('kccjpm')},
  {name: 'jd', label: labelOf('jd')},
  {name: 'xfjd', label: labelOf('xfjd')},
  {name: 'ksxz', label: labelOf('ksxz')},
  {name: 'tjrxm', label: labelOf('tjrxm')},
  {name: 'tjsj', label: labelOf('tjsj')},
  {name: 'symc', label: labelOf('symc')},
  {name: 'sqmc', label: labelOf('sqmc')},
  {name: 'ssfdyjghxm', label: labelOf('ssfdyjghxm')},
  {name: 'xydsjghxm', label: labelOf('xydsjghxm')},
  {name: 'xh_id', label: labelOf('xh_id')},
];

/**
 * Fields that key a record rather than describe it.
 *
 * Kept out of the displayed rows: `key` is the grid's row id and `sfkk`,
 * `sfxsts` and `sfcxkkxq` are flags the page tests but never shows. Rendering an
 * opaque id as a line of the table is noise.
 */
const IDENTIFIER_FIELDS = new Set([
  'key',
  'sfxsts',
  'sfcxkkxq',
  'sfkk',
  'sfjf',
  'ksxzdm',
]);

/**
 * Splits one record into the columns to show, and whatever is left over.
 *
 * A value of `null`, `undefined` or `''` is dropped rather than rendered blank:
 * a sub-score the service did not fill in is an absence, and printing an empty
 * cell next to a filled one invites reading the two as different in kind.
 *
 * The remainder is returned so the screen can show it instead of hiding it. A
 * field this vocabulary has never heard of is a fact about the reply, and
 * dropping it would make the app look complete when it is not.
 */
const partitionRecord = (
  record: {[field: string]: unknown},
  order: Column[],
): {
  known: Array<{label: string; name: string; value: unknown}>;
  rest: Array<{label: string; name: string; value: unknown}>;
} => {
  const present = (value: unknown): boolean =>
    value !== null && value !== undefined && value !== '';
  const known: Array<{label: string; name: string; value: unknown}> = [];
  const claimed = new Set<string>();
  for (const column of order) {
    if (claimed.has(column.name)) {
      continue;
    }
    claimed.add(column.name);
    if (present(record[column.name])) {
      known.push({...column, value: record[column.name]});
    }
  }
  const rest: Array<{label: string; name: string; value: unknown}> = [];
  for (const [name, value] of Object.entries(record)) {
    if (claimed.has(name) || IDENTIFIER_FIELDS.has(name) || !present(value)) {
      continue;
    }
    rest.push({label: labelOf(name), name, value});
  }
  return {known, rest};
};

/**
 * Finds the list inside a reply.
 *
 * **The envelope is not established.** The page builds its grid with
 * `$.extend({}, BaseJqGrid, {...})`, and `BaseJqGrid` is defined in a shared
 * base script that is not reachable: `rows`, `records`, `total` and
 * `setGridData` appear zero times in the page's own source, so the reply's shape
 * belongs entirely to that wrapper, and none of the 16 plausible paths for it
 * answered 200.
 *
 * So this does not claim a shape. It tries the three a reply of this family
 * could plausibly take, in the order of how likely each is to be right:
 *
 *   1. `{items: [...]}` -- the envelope the score parser on this host reads, so
 *      the one shape actually measured.
 *   2. a bare array.
 *   3. an array under any other key. This is deliberately unnamed rather than
 *      matched against `rows`: it covers a jqGrid wrapper's reply and an object
 *      keyed by course with an array per course in one go, and it does so
 *      without committing to a key name the page never showed. A reply with
 *      several such keys takes the first in property order, which is a guess
 *      about which one is the list -- so the screen keeps the endpoint URL on
 *      display, and that guess stays checkable rather than hidden.
 *
 * What is *not* handled is a reply whose rows are not arrays at all. Rather than
 * flatten a nested structure into invented field names, that reply is shown raw.
 */
const rowsOf = (json: unknown): Array<{[field: string]: unknown}> => {
  const records = (value: unknown[]): Array<{[field: string]: unknown}> =>
    value.filter(
      (item): item is {[field: string]: unknown} =>
        typeof item === 'object' && item !== null && !Array.isArray(item),
    );

  if (Array.isArray(json)) {
    return records(json);
  }
  if (typeof json !== 'object' || json === null) {
    return [];
  }
  const record = json as {[field: string]: unknown};
  if (Array.isArray(record['items'])) {
    return records(record['items']);
  }
  for (const value of Object.values(record)) {
    if (Array.isArray(value) && value.some(item => typeof item === 'object')) {
      return records(value);
    }
  }
  return [];
};

export {
  COURSE_COLUMNS,
  FIELDS_WITHOUT_PAGE_LABEL,
  GRADE_QUERY_DO_TYPE,
  GRADE_QUERY_FIELDS,
  GRADE_QUERY_PATH,
  IDENTIFIER_FIELDS,
  PAGE_LABEL,
  ROSTER_COLUMNS,
  STUDENT_GRADE_QUERY_PATH,
  STUDENT_ZD_FZDM,
  TEACHER_ZD_FZDM,
  WHU_SCHOOL_CODE,
  hasPageLabel,
  labelOf,
  partitionRecord,
  rowsOf,
};
export type {Column};
