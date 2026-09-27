import {getCourseList} from '@/business/education/course/api';
import {getScoreList} from '@/business/education/score/api';
import {loginEducation} from '@/business/education';
import Log from '@/modules/NativeLog';
import Cas from '@/business/cas';

jest.mock('@/business/cas', () => ({
  __esModule: true,
  default: {Api: {fastLogin: jest.fn()}},
}));

const mockLog = Log as jest.Mocked<typeof Log>;
const mockCas = Cas as jest.Mocked<typeof Cas>;

const loggedText = (): string =>
  [...mockLog.i.mock.calls, ...mockLog.e.mock.calls]
    .map(call => call.join(' '))
    .join('\n');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('education response logging', () => {
  it('does not log the course response body', async () => {
    const payload = JSON.stringify({
      xsxx: {XH: '20260001'},
      kbList: [{kcmc: '私有课程', jxbmc: 'private-course'}],
    });
    global.fetch = jest.fn(() =>
      Promise.resolve(new Response(payload)),
    ) as jest.Mock;

    await getCourseList({year: 2026, semester: 1, validate: 'v'});

    expect(loggedText()).not.toContain(payload);
    expect(loggedText()).not.toContain('私有课程');
    expect(loggedText()).not.toContain('20260001');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('jwgl.whu.edu.cn'),
      expect.objectContaining({
        headers: expect.objectContaining({Cookie: ''}),
      }),
    );
  });

  it('does not log the score response body', async () => {
    const payload = JSON.stringify({
      items: [{kcmc: '私有成绩', xh: '20260001', xf: '4', bfzcj: '95'}],
    });
    global.fetch = jest.fn(() =>
      Promise.resolve(new Response(payload)),
    ) as jest.Mock;

    await getScoreList({validate: 'v'});

    expect(loggedText()).not.toContain(payload);
    expect(loggedText()).not.toContain('私有成绩');
    expect(loggedText()).not.toContain('20260001');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('jwgl.whu.edu.cn'),
      expect.objectContaining({
        headers: expect.objectContaining({Cookie: ''}),
      }),
    );
  });

  it('does not log the CAS login page body', async () => {
    const html = `<html><body>${'private-page'.repeat(1000)}</body></html>`;
    const url = 'https://cas.whu.edu.cn/authserver/login?service=x';
    (mockCas.Api.fastLogin as jest.Mock).mockResolvedValue({
      url,
      text: () => Promise.resolve(html),
    });

    await expect(loginEducation()).rejects.toThrow();

    expect(loggedText()).not.toContain('private-page');
  });
});
