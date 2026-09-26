import en from '@/i18n/en/translation.json';
import ja from '@/i18n/ja/translation.json';
import zh from '@/i18n/zh/translation.json';

type TranslationTree = {
  [key: string]: string | TranslationTree;
};

const leafKeys = (tree: TranslationTree, prefix = ''): string[] =>
  Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? [path] : leafKeys(value, path);
  });

describe('translation resources', () => {
  it('keeps the same leaf keys in every supported language', () => {
    const expected = leafKeys(zh).sort();
    expect(leafKeys(en).sort()).toEqual(expected);
    expect(leafKeys(ja).sort()).toEqual(expected);
  });
});
