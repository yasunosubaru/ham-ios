import {
  LibraryApiError,
  parseConfigEnvelope,
  parseRecord,
  parseToken,
} from '@/business/library/parser';
import {LIBRARY_FRONT_END} from '@/business/library/type';

/**
 * A `getSysSet/PC` response captured verbatim from the live service on
 * 2026-09-27.
 *
 * Pasted as the real body, not a tidy stand-in, for the same reason the weather
 * fixtures are: two details in it are easy to smooth away and expensive to get
 * wrong.
 *
 *   - `hmac` is the number 1 and `hmacKey` is an AES ciphertext. A fixture that
 *     put a plaintext key there would make the signing look like a formality,
 *     and the decryption step would never be exercised.
 *   - `vueConfig` values are all *strings*, including the booleans: `CASLOGIN`
 *     is `"2"`, not `2`, and `preBook` is `"true"`, not `true`. The service's
 *     own client string-compares them, which only works because they arrive as
 *     strings.
 *
 * The `readText` value is HTML full of Chinese and degree signs; the console
 * shows it as mojibake but the bytes are correct, and a parser that chokes on
 * it would be a parser that breaks on the real notice text.
 */
const REAL_CONFIG_RESPONSE = {
  status: true,
  code: 200,
  message: '操作成功',
  data: {
    todayTime: '01:00',
    futureCond: '22:45',
    futureCondTime: 1365,
    futureMakeDay: 1,
    mackCaptcha: 2,
    signStartMinute: 60,
    signEndMinute: 30,
    sceneLoginSign: 1,
    cancelMinute: -35,
    extendMinute: 30,
    stopMinute: 0,
    teamMax: 4,
    superviseAway: 0,
    jdZlImgUpload: 0,
    breachType: 0,
    cycleDay: 0,
    breachMax: 7,
    blackDay: 1,
    scoreInit: 300,
    scoreDel: 30,
    scoreMin: 10,
    readText:
      '<p style="text-align: center;" align="center"><span style="font-size: 16px;"><strong><span style="color: #e03e2d;">本学期开放时间以通知为准</span></strong></span></p>\n<p>?</p>\n<p style="text-align: justify;"><span style="font-family: \'Microsoft YaHei\', \'Helvetica Neue\', \'PingFang SC\', sans-serif;">各位读者：</span></p>\n<p style="text-align: justify;">?</p>\n<p style="text-align: justify; text-indent: 2em;"><span style="font-family: \'Microsoft YaHei\', \'Helvetica Neue\', \'PingFang SC\', sans-serif;">图书馆入馆学习与研讨预约系统已开放预约</span></p>\n<p style="text-align: justify; text-indent: 2em;">?</p>\n<p style="text-align: justify; text-indent: 2em;"><span style="font-family: \'Microsoft YaHei\', \'Helvetica Neue\', \'PingFang SC\', sans-serif; color: #e03e2d;">本学期座位开放时间为7月31日7：00-12：00</span></p>\n<p style="text-align: justify;">?</p>\n<p style="text-align:',
    readTextE: '<p>Opening hours this term are announced by notice.</p>',
    readType: 1,
    agreements: '使用预约系统即表示同意预约规则。',
    agreementsE: 'Using the booking system means accepting the rules.',
    schoolKey: 'whu',
    hmac: 1,
    hmacKey: 'iME1t2eGBH8HjzXSLnhuMw==',
    fixQrSign: 0,
    remVersion: 1,
    buildSeTime: {start: '2026-09-01 00:00:00', end: '2026-09-30 23:59:59'},
    vueConfig: {
      AWAYBACK: '30',
      CASLOGIN: '2',
      CASSSERVICE: 'https://seat.lib.whu.edu.cn/rem',
      CHECKIN: 'false',
      CONTINUESEAT: 'false',
      HOMESHOWTYPE: '1',
      OPENDEVTOOLS: 'false',
      VUESERVICE: 'https://seat.lib.whu.edu.cn/seat',
      cardModel: '1',
      cardType: '1',
      casBtnEn: 'Sign in with your university account',
      casBtnZh: '使用信息门户账号登录',
      doorLog: 'true',
      feedback: 'true',
      fixedLogin: 'false',
      fixedParam: '',
      fixedSplit: '',
      homePageRoomRate: 'true',
      htmlTitleEn: 'Seat booking',
      htmlTitleZh: '座位预约',
      includeRoomIds: '',
      linkBtn: 'true',
      loginBtnEn: 'Sign in',
      loginBtnZh: '登录',
      noCasLoginUrl: '',
      noLoginMsgEn: 'Please sign in',
      noLoginMsgZh: '请先登录',
      noUseLogOutRate: 'false',
      planBook: 'false',
      preBook: 'true',
      qrCodeRate: 'true',
      showActCode: 'false',
      showBtn: 'true',
      showTeam: 'true',
      showWechat: 'false',
      signExtendModel: '1',
      specialRoomType: '1',
      tabScan: 'true',
    },
    specialRoomResList: [],
    faceOpen: false,
  },
} as const;

/** The real reply an unauthenticated data endpoint gives. */
const REAL_UNAUTHENTICATED_RESPONSE = {
  status: false,
  code: 20002,
  message: 'token认证无效',
} as const;

describe('parseConfigEnvelope, against the captured response', () => {
  it('reads the signing configuration', () => {
    const config = parseConfigEnvelope(REAL_CONFIG_RESPONSE);

    // 1 means every authenticated request has to carry the signature headers.
    expect(config.hmac).toBe(1);
    // A ciphertext, not a usable key: this is what makes the decryption step
    // load-bearing rather than decorative.
    expect(config.hmacKey).toBe('iME1t2eGBH8HjzXSLnhuMw==');
  });

  it('reads the CAS wiring out of vueConfig, as strings', () => {
    const config = parseConfigEnvelope(REAL_CONFIG_RESPONSE);

    expect(config.casService).toBe('https://seat.lib.whu.edu.cn/rem');
    expect(config.vueService).toBe(LIBRARY_FRONT_END);
    // "2", not 2. A numeric cast here would quietly turn a mode the app does
    // not understand into one it thinks it does.
    expect(config.casLogin).toBe('2');
    expect(typeof config.casLogin).toBe('string');
  });

  it('reads the booking rules', () => {
    const config = parseConfigEnvelope(REAL_CONFIG_RESPONSE);

    expect(config).toMatchObject({
      breachMax: 7,
      cancelMinute: -35,
      extendMinute: 30,
      futureCondTime: 1365,
      futureMakeDay: 1,
      mackCaptcha: 2,
      scoreDel: 30,
      scoreInit: 300,
      scoreMin: 10,
      signEndMinute: 30,
      signStartMinute: 60,
      stopMinute: 0,
      superviseAway: 0,
      teamMax: 4,
    });
    // A negative cancel window is real: it means "this many minutes before the
    // start". Coercing it to a magnitude would invert the meaning.
    expect(config.cancelMinute).toBeLessThan(0);
  });

  it('keeps a rule of zero as zero rather than treating it as missing', () => {
    // `stopMinute` is 0 in the captured body. A truthiness check would report
    // it as absent and leave the field undefined, which reads as "unknown"
    // rather than "no grace period".
    const config = parseConfigEnvelope(REAL_CONFIG_RESPONSE);
    expect(config.stopMinute).toBe(0);
  });

  it('keeps the notice text as sent', () => {
    const config = parseConfigEnvelope(REAL_CONFIG_RESPONSE);

    expect(config.notice.zh).toContain('本学期开放时间以通知为准');
    expect(config.notice.en).toContain('Opening hours this term');
  });
});

describe('parseConfigEnvelope, malformed bodies', () => {
  it('names the field when a booking rule is missing', () => {
    const data = {...REAL_CONFIG_RESPONSE.data} as {[key: string]: unknown};
    delete data['futureMakeDay'];

    // A rule read as undefined would surface as "you may not book ahead",
    // which is a rule the service never sent.
    expect(() => parseConfigEnvelope({...REAL_CONFIG_RESPONSE, data})).toThrow(
      /missing a usable "futureMakeDay"/,
    );
  });

  it('falls back to the measured defaults when vueConfig is absent', () => {
    const data = {...REAL_CONFIG_RESPONSE.data} as {[key: string]: unknown};
    delete data['vueConfig'];

    const config = parseConfigEnvelope({...REAL_CONFIG_RESPONSE, data});

    expect(config.vueService).toBe(LIBRARY_FRONT_END);
    expect(config.casService).toBe('');
    expect(config.casLogin).toBe('0');
  });
});

describe('the response envelope', () => {
  it('raises the service code when status is false', () => {
    // The service answers HTTP 200 for failures, so only the body says no.
    expect(() => parseRecord(REAL_UNAUTHENTICATED_RESPONSE)).toThrow(
      LibraryApiError,
    );
    try {
      parseRecord(REAL_UNAUTHENTICATED_RESPONSE);
    } catch (error) {
      expect((error as LibraryApiError).code).toBe(20002);
      expect((error as LibraryApiError).needsLogin).toBe(false);
    }
  });

  it('tells an expired session apart from a bad token', () => {
    // 20003 means re-run the CAS redirect; 20002 means the token is wrong.
    // Conflating them sends the user to sign in again for nothing.
    const expired = new LibraryApiError('20003', 'session expired');
    const invalid = new LibraryApiError(20002, 'token invalid');

    expect(expired.needsLogin).toBe(true);
    expect(invalid.needsLogin).toBe(false);
  });

  it('rejects a body that is not the expected shape', () => {
    // An empty record would read as "you have no bookings", which is a very
    // different thing from "the reply made no sense".
    expect(() => parseRecord('nope')).toThrow(LibraryApiError);
    expect(() =>
      parseRecord({status: true, code: 200, data: null}),
    ).not.toThrow();
  });
});

describe('parseToken', () => {
  it('reads a token out of the sign-in response', () => {
    expect(
      parseToken({
        status: true,
        code: 200,
        message: 'ok',
        data: {token: 'abc'},
      }),
    ).toBe('abc');
  });

  it('reports an absent token as absent, not as an empty string', () => {
    // The difference decides whether the app sends the user back through CAS.
    expect(
      parseToken({status: true, code: 200, message: 'ok', data: {}}),
    ).toBeUndefined();
    expect(
      parseToken({status: true, code: 200, message: 'ok', data: {token: ''}}),
    ).toBeUndefined();
  });
});
