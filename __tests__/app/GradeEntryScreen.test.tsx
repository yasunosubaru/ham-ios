import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
// The real i18n instance, so a missing key fails here rather than rendering the
// raw key into the UI.
import '@/i18n/i18n';
import HamApp from '@/app/HamApp';
import CasModule from '@/modules/NativeCasModule';
import {getWeather} from '@/business/weather';
import {getLibraryConfig, signIn} from '@/business/library';

jest.mock('@/business/weather', () => {
  const actual = jest.requireActual('@/business/weather');
  return {...actual, getWeather: jest.fn()};
});

jest.mock('@/business/library', () => {
  const actual = jest.requireActual('@/business/library');
  return {...actual, getLibraryConfig: jest.fn(), signIn: jest.fn()};
});

// The page component is stubbed rather than rendered: what these tests are about
// is the screen's decisions -- which view it puts up, and what it does with a
// reply -- not WebView's own behaviour, which the hook tests cover.
const webViewProps: {current: {onResult?: unknown; onUnavailable?: unknown}} = {
  current: {},
};
jest.mock('@/components/education/EducationPageView', () => {
  const {View} = require('react-native');
  return {
    __esModule: true,
    default: (props: {
      onResult: (r: {body: string; url: string}) => void;
      onUnavailable: () => void;
      testID?: string;
    }) => {
      webViewProps.current.onResult = props.onResult;
      webViewProps.current.onUnavailable = props.onUnavailable;
      return <View testID={props.testID ?? 'education-page-webview'} />;
    },
    CAS_SIGN_IN_URL: 'https://cas.whu.edu.cn/authserver/login?service=x',
    EDUCATION_HOME_TITLE: '教学管理信息服务平台',
    SCORE_PAGE_URL:
      'https://jwgl.whu.edu.cn/cjcx/cjcx_cxDgXscj.html?gnmkdm=N305005',
    TEACHER_PAGE_URL:
      'https://jwgl.whu.edu.cn/cjcx/cjcx_cxDgXscj.html?doType=query&gnmkdm=N305005',
  };
});

const mockGetWeather = getWeather as jest.MockedFunction<typeof getWeather>;
const mockGetConfig = getLibraryConfig as jest.MockedFunction<
  typeof getLibraryConfig
>;
const mockSignIn = signIn as jest.MockedFunction<typeof signIn>;

const casModule = CasModule as unknown as {
  clearCasCookie: jest.Mock;
  requestCasCookie: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
  webViewProps.current = {};
  casModule.clearCasCookie.mockResolvedValue(true);
  casModule.requestCasCookie.mockReturnValue('');
  mockGetWeather.mockResolvedValue({
    current: {
      apparentTemperature: 27.3,
      condition: 'mainlyClear' as const,
      humidity: 88,
      observedAt: '2026-09-27T00:15',
      precipitation: 0,
      temperature: 23.4,
      windSpeed: 4.5,
    },
    daily: [],
    timezone: 'Asia/Shanghai',
  });
  mockGetConfig.mockResolvedValue({
    blackDay: 1,
    breachMax: 7,
    cancelMinute: -35,
    casLogin: '2',
    casService: 'https://seat.lib.whu.edu.cn/rem',
    extendMinute: 30,
    futureCondTime: 1365,
    futureMakeDay: 1,
    hmac: 1,
    hmacKey: 'iME1t2eGBH8HjzXSLnhuMw==',
    mackCaptcha: 2,
    notice: {en: '', zh: ''},
    scoreDel: 30,
    scoreInit: 300,
    scoreMin: 10,
    signEndMinute: 30,
    signStartMinute: 60,
    stopMinute: 0,
    superviseAway: 0,
    teamMax: 4,
    vueService: 'https://seat.lib.whu.edu.cn/seat',
  });
  mockSignIn.mockResolvedValue('a-library-token');
});

describe('the grade entry card', () => {
  it('is reachable from the home list', async () => {
    await render(<HamApp />);
    expect(screen.getByTestId('grades')).toBeOnTheScreen();
  });

  it('puts the sign-in view in front of the page without a session', async () => {
    await render(<HamApp />);
    await fireEvent.press(screen.getByTestId('grades'));

    // Nothing is requested: the education session comes from the WebView's own
    // navigation, so there is no call to make before the page is up.
    expect(screen.queryByTestId('education-page-webview')).toBeNull();
    expect(screen.getByTestId('back-button')).toBeOnTheScreen();
  });

  it('opens the page once a session exists', async () => {
    casModule.requestCasCookie.mockReturnValue('a-cas-cookie');
    await render(<HamApp />);
    await fireEvent.press(screen.getByTestId('grades'));

    await waitFor(() =>
      expect(screen.getByTestId('education-page-webview')).toBeOnTheScreen(),
    );
  });
});

describe('what the grade entry screen does with a reply', () => {
  const openWithSession = async (): Promise<void> => {
    casModule.requestCasCookie.mockReturnValue('a-cas-cookie');
    await render(<HamApp />);
    await fireEvent.press(screen.getByTestId('grades'));
    await waitFor(() =>
      expect(screen.getByTestId('education-page-webview')).toBeOnTheScreen(),
    );
  };

  it('names the fields it knows, by the labels the page defines', async () => {
    await openWithSession();

    const onResult = webViewProps.current.onResult as (r: {
      body: string;
      url: string;
    }) => void;
    onResult({
      body: JSON.stringify({
        items: [{kch: 'MATH101', kcmc: '高等数学', xf: '5.0', xm: '未知字段'}],
      }),
      url: 'https://jwgl.whu.edu.cn/cjcx/cjcx_cxXsgrcj.html?doType=query',
    });

    await waitFor(() => expect(screen.getByText('课程名称')).toBeOnTheScreen());
    // The page's own column labels, not a reading of the field names.
    expect(screen.getByText('课程代码')).toBeOnTheScreen();
    expect(screen.getByText('学分')).toBeOnTheScreen();
    expect(screen.getByText('高等数学')).toBeOnTheScreen();
    // The label carries the path and query, not the host, so it stays readable.
    expect(
      screen.getByText('接口 /cjcx/cjcx_cxXsgrcj.html?doType=query'),
    ).toBeOnTheScreen();
  });

  it('calls a reply with no student id a course list', async () => {
    await openWithSession();

    const onResult = webViewProps.current.onResult as (r: {
      body: string;
      url: string;
    }) => void;
    onResult({
      body: JSON.stringify({items: [{kcmc: '高等数学'}, {kcmc: '大学物理'}]}),
      url: 'https://jwgl.whu.edu.cn/cjcx/cjcx_cxXsgrcj.html',
    });

    await waitFor(() =>
      expect(screen.getByText('共 2 条课程')).toBeOnTheScreen(),
    );
  });

  it('calls a reply with student ids a roster', async () => {
    // The two are told apart by whether a student id is present, which is the
    // one structural difference the page's own column model makes visible
    // before any reply has been seen.
    await openWithSession();

    const onResult = webViewProps.current.onResult as (r: {
      body: string;
      url: string;
    }) => void;
    onResult({
      body: JSON.stringify({
        items: [{xh: '20260001', xm: '某某', bfzcj: '92'}],
      }),
      url: 'https://jwgl.whu.edu.cn/cjcx/cjcx_cxXsgrcj.html',
    });

    await waitFor(() =>
      expect(screen.getByText('共 1 名学生')).toBeOnTheScreen(),
    );
    // `bfzcj` is the field the page itself decides a row by, and it is the one
    // field with no label anywhere in the page -- so it is shown under its own
    // name rather than under a plausible invention.
    expect(screen.getByText('bfzcj')).toBeOnTheScreen();
    expect(screen.queryByText('总评成绩')).toBeNull();
  });

  it('says how many fields it did not recognise, instead of dropping them', async () => {
    // A field outside the vocabulary is a fact about the reply. Hiding it would
    // make the screen look complete when it is not.
    await openWithSession();

    const onResult = webViewProps.current.onResult as (r: {
      body: string;
      url: string;
    }) => void;
    onResult({
      body: JSON.stringify({
        items: [{kcmc: '高等数学', unknownA: '1', unknownB: '2'}],
      }),
      url: 'https://jwgl.whu.edu.cn/cjcx/cjcx_cxXsgrcj.html',
    });

    await waitFor(() =>
      expect(screen.getByText('另有 2 个未收录字段')).toBeOnTheScreen(),
    );
  });

  it('shows a reply that is not a list, rather than an empty screen', async () => {
    // A status or a count is still information. Replacing it with "nothing to
    // display" would throw away the only thing the endpoint said.
    await openWithSession();

    const onResult = webViewProps.current.onResult as (r: {
      body: string;
      url: string;
    }) => void;
    onResult({
      body: JSON.stringify({status: true, count: 0}),
      url: 'https://jwgl.whu.edu.cn/cjcx/cjcx_cxXxCount.html',
    });

    await waitFor(() =>
      expect(
        screen.getByText('这个接口没有返回列表，原文如下：'),
      ).toBeOnTheScreen(),
    );
    expect(screen.getByText('count')).toBeOnTheScreen();
  });

  it('says so when the endpoint answered with nothing readable', async () => {
    await openWithSession();

    const onUnavailable = webViewProps.current.onUnavailable as () => void;
    onUnavailable();

    await waitFor(() =>
      expect(
        screen.getByText(
          '教务系统没有返回可读取的数据，可能需要重新登录后重试。',
        ),
      ).toBeOnTheScreen(),
    );
  });

  it('states that it submits nothing', async () => {
    await openWithSession();

    const onResult = webViewProps.current.onResult as (r: {
      body: string;
      url: string;
    }) => void;
    onResult({
      body: '{}',
      url: 'https://jwgl.whu.edu.cn/cjcx/cjcx_cxXsgrcj.html',
    });

    await waitFor(() =>
      expect(
        screen.getByText(
          '此功能只读取页面返回的内容，不会向教务系统提交任何数据。',
        ),
      ).toBeOnTheScreen(),
    );
  });
});
