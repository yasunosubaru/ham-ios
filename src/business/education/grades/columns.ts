/**
 * Field vocabulary for the education system's grids, read out of the page's own
 * `getGridColModel()`.
 *
 * That function pushes 108 columns across 48 `colModelArr.push(...)` calls. A
 * single `jsxx` test wraps only the first stretch of it, and there is no `else`:
 * which columns appear is decided by the school code `sxxdm`, not by the role.
 * So "the teacher's fields" is not a separate list -- it is this list, with
 * different gates. The entries below are the ones that apply to Wuhan
 * University itself (`sxxdm == '10486'`) plus the ungated ones, since those are
 * what a WHU account actually receives.
 *
 * The labels come from the same column definitions, so a field's meaning here is
 * the system's own rather than a reading of its name.
 *
 * What is *not* established: the shape of a teacher reply. Which endpoint
 * answers, whether it is a course list or a roster, and what each row carries,
 * cannot be known without a teacher session -- every `.html` on that host
 * redirects to the login page whether or not it exists, so there is no way to
 * tell a real path from an invented one anonymously. Hence
 * {@link ROSTER_COLUMNS} being an *order to try*, not a claim, and the screen
 * falling back to showing whatever else the reply contained.
 */

/** A column as the page defines it. */
interface Column {
  /** What the screen calls it. Empty when the page uses an i18n key we cannot resolve. */
  label: string;
  /** The payload field, which is the only part that matters to a client. */
  name: string;
}

/**
 * Course-level columns, in the order a course list is most usefully read.
 *
 * `jxb_id` first among the identifiers because it is the drill-down key: the
 * page's own request parameters carry `jxb_id`, `xh_id` and `kch_id`, which is
 * what says the list is a teaching-class list and that a roster hangs off it.
 */
const COURSE_COLUMNS: Column[] = [
  {name: 'kch', label: '课程代码'},
  {name: 'kcmc', label: '课程名称'},
  {name: 'jxbmc', label: '教学班'},
  {name: 'xf', label: '学分'},
  {name: 'kkbmmc', label: '开课部门'},
  {name: 'kclbmc', label: '课程类别'},
  {name: 'kcgsmc', label: '课程归属'},
  {name: 'kcxzmc', label: '课程性质'},
  {name: 'jsxm', label: '任课教师'},
  {name: 'khfsmc', label: '考核方式'},
  {name: 'xnm', label: '学年'},
  {name: 'xqm', label: '学期'},
  {name: 'jxb_id', label: '教学班ID'},
  {name: 'kch_id', label: '课程ID'},
  {name: 'xsbjmc', label: '教材名称'},
  {name: 'xfjd', label: '学分绩点'},
];

/** Mark-level columns, in the order a roster is most usefully read. */
const ROSTER_COLUMNS: Column[] = [
  {name: 'xh', label: '学号'},
  {name: 'xm', label: '姓名'},
  {name: 'bfzcj', label: '总评成绩'},
  {name: 'cj', label: '成绩'},
  {name: 'yscj', label: '原始成绩'},
  {name: 'ysbfzcj', label: '加分前百分制成绩'},
  {name: 'qmcj', label: '期末'},
  {name: 'qzcj', label: '期中'},
  {name: 'pscj', label: '平时'},
  {name: 'sycj', label: '实验'},
  {name: 'cjfxzh', label: '期末成绩'},
  {name: 'qmblzh', label: '期末成绩'},
  {name: 'bzxx', label: '备注'},
  {name: 'cjsfzf', label: '是否加分'},
  {name: 'sfjf', label: '是否加分'},
  {name: 'ksxzdm', label: '考试性质代码'},
  {name: 'jycj', label: '结业成绩'},
  {name: 'jybkcj', label: '结业补考成绩'},
  {name: 'xmblzbh', label: '成绩分项比例编号'},
  {name: 'xmblbz', label: '项目比例备注'},
  {name: 'xmcjbz', label: '项目成绩'},
  {name: 'tjrxm', label: '提交人'},
  {name: 'tjsj', label: '提交时间'},
  {name: 'symc', label: '书院名称'},
  {name: 'sqmc', label: '书社名称'},
  {name: 'ssfdyjghxm', label: '辅导员'},
  {name: 'xydsjghxm', label: '学业导师'},
  {name: 'xh_id', label: '学生ID'},
];

/**
 * Fields that identify a record rather than describe it.
 *
 * Kept out of the displayed columns and used for keys and drill-down instead: a
 * grid shows `jh` (教学班号) and `xqdm` (校区代码) as data, and rendering an
 * opaque id as a row of the table is noise.
 */
const IDENTIFIER_FIELDS = new Set([
  'key',
  'jxb_id',
  'xh_id',
  'kch_id',
  'sfxsts',
  'sfcxkkxq',
  'sfkk',
  'xscjcksz',
]);

const LABEL_BY_NAME = new Map<string, string>(
  [...COURSE_COLUMNS, ...ROSTER_COLUMNS].map(column => [
    column.name,
    column.label,
  ]),
);

/** The system's name for a field, or the field itself when it has no label. */
const labelOf = (name: string): string => LABEL_BY_NAME.get(name) ?? name;

/**
 * Splits one record into the columns to show, and whatever is left over.
 *
 * A value of `null` or an empty string is dropped rather than rendered blank: a
 * sub-score column that the service did not fill in is an absence, and printing
 * an empty cell next to a real one invites reading them as different.
 *
 * The remainder is returned so the screen can show it instead of hiding it. A
 * field this list has never heard of is a fact about the reply, and dropping it
 * would make the app look complete when it is not.
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
 * The envelope is `{items: [...]}` for the score query, confirmed by the
 * parser that reads the same host's replies. An array at the top level, and a
 * single-key array-valued property, are the two other shapes a reply of this
 * family plausibly takes -- checked in that order because the first is the one
 * actually measured and the others are fallbacks rather than claims.
 */
const rowsOf = (json: unknown): Array<{[field: string]: unknown}> => {
  if (Array.isArray(json)) {
    return json.filter(
      (item): item is {[field: string]: unknown} =>
        typeof item === 'object' && item !== null && !Array.isArray(item),
    );
  }
  if (typeof json !== 'object' || json === null) {
    return [];
  }
  const record = json as {[field: string]: unknown};
  if (Array.isArray(record['items'])) {
    return record['items'].filter(
      (item): item is {[field: string]: unknown} =>
        typeof item === 'object' && item !== null && !Array.isArray(item),
    );
  }
  for (const [key, value] of Object.entries(record)) {
    if (Array.isArray(value) && value.some(item => typeof item === 'object')) {
      return value.filter(
        (item): item is {[field: string]: unknown} =>
          typeof item === 'object' && item !== null && !Array.isArray(item),
      );
    }
    if (key === 'items') {
      return [];
    }
  }
  return [];
};

export {
  COURSE_COLUMNS,
  IDENTIFIER_FIELDS,
  LABEL_BY_NAME,
  ROSTER_COLUMNS,
  labelOf,
  partitionRecord,
  rowsOf,
};
export type {Column};
