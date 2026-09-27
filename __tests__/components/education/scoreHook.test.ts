import {
  buildScoreHookScript,
  DEFAULT_TARGETS,
  parsePageMessage,
} from '@/components/education/scoreHook';
import {
  CAS_SIGN_IN_URL,
  EDUCATION_HOME_TITLE,
  SCORE_PAGE_URL,
  TEACHER_PAGE_URL,
} from '@/components/education/EducationPageView';

describe('parsePageMessage', () => {
  it('reads a result with the endpoint that produced it', () => {
    // The URL travels with the body on purpose: the grade-entry screen has to
    // tell a course list from a mark-detail list, and it cannot hardcode which
    // endpoint answers which.
    expect(
      parsePageMessage(
        JSON.stringify({
          type: 'result',
          url: 'https://jwgl.whu.edu.cn/cjcx/cjcx_cxXsgrcj.html?doType=query',
          body: '{"items":[]}',
        }),
      ),
    ).toEqual({
      body: '{"items":[]}',
      type: 'result',
      url: 'https://jwgl.whu.edu.cn/cjcx/cjcx_cxXsgrcj.html?doType=query',
    });
  });

  it('reads the captcha flag', () => {
    expect(
      parsePageMessage(JSON.stringify({type: 'captcha', required: true})),
    ).toEqual({required: true, type: 'captcha'});
  });

  it('reads an endpoint that answered with something other than JSON', () => {
    expect(
      parsePageMessage(
        JSON.stringify({
          type: 'result-unavailable',
          url: 'https://jwgl.whu.edu.cn/cjcx/cjcx_cxXsgrcj.html',
        }),
      ),
    ).toEqual({
      type: 'result-unavailable',
      url: 'https://jwgl.whu.edu.cn/cjcx/cjcx_cxXsgrcj.html',
    });
  });

  it('ignores anything that is not a message it understands', () => {
    // This is a string from a web page arriving in a message handler, so a
    // malformed one has to become "nothing happened" rather than an exception
    // that takes the screen down with it.
    expect(parsePageMessage('not json')).toBeUndefined();
    expect(parsePageMessage('')).toBeUndefined();
    expect(parsePageMessage(undefined)).toBeUndefined();
    expect(parsePageMessage(42)).toBeUndefined();
    expect(parsePageMessage(null)).toBeUndefined();
    expect(parsePageMessage(JSON.stringify({type: 'result'}))).toBeUndefined();
    expect(
      parsePageMessage(JSON.stringify({type: 'result', url: 'x'})),
    ).toBeUndefined();
    expect(parsePageMessage(JSON.stringify({type: 'other'}))).toBeUndefined();
  });
});

describe('the injected hook', () => {
  it('names the endpoints it was asked to watch', () => {
    const script = buildScoreHookScript(['cjcx_cxXsgrcj', 'mxdx_cxMxdx']);

    expect(script).toContain('["cjcx_cxXsgrcj","mxdx_cxMxdx"]');
  });

  it('defaults to the one endpoint the score screen knows', () => {
    expect(buildScoreHookScript()).toContain(JSON.stringify(DEFAULT_TARGETS));
    expect(DEFAULT_TARGETS).toContain('cjcx_cxXsgrcj');
  });

  it('installs itself only once per page', () => {
    // The script is injected on every navigation. Re-patching the prototype
    // would wrap `open` and `send` again, and the second wrapper would report
    // every response twice.
    expect(buildScoreHookScript()).toContain('window.__hamScoreHook');
  });

  it('reads a response as JSON and reports anything else as unavailable', () => {
    // The host answers 200 with an HTML page for several failures, so the first
    // character is the only thing that tells a result from a login redirect.
    const script = buildScoreHookScript();
    expect(script).toMatch(/first !== .\{./);
    expect(script).toMatch(/first !== .\[./);
    expect(script).toContain('result-unavailable');
  });

  it('reports a captcha only for the student view', () => {
    // All three of the page's own checks read `... && jsxx == "xs"`, so a
    // teacher page is never gated. Reporting one as gated would send the user
    // looking for something that is not there.
    const script = buildScoreHookScript();
    expect(script).toMatch(/role\.value === .xs./);
    expect(script).toMatch(/flag\.value === .1./);
    expect(script).toMatch(/flag\.value === .2./);
  });

  it('tells the caller which endpoint a result came from', () => {
    expect(buildScoreHookScript()).toContain('url: url, body: text');
  });

  it('survives a missing bridge', () => {
    // During teardown the native object is gone. Throwing there would be an
    // uncaught error inside the page, and the data is still on screen.
    expect(buildScoreHookScript()).toContain('catch (error)');
  });
});

describe('the page addresses', () => {
  it('points both roles at the same page, as the server does', () => {
    // Student and teacher views are one page, one gnmkdm, branched by a hidden
    // `jsxx` field the server sets from the account's role. The teacher URL only
    // adds `doType=query` and keeps `gnmkdm=N305005`.
    expect(SCORE_PAGE_URL).toContain('cjcx/cjcx_cxDgXscj.html');
    expect(SCORE_PAGE_URL).toContain('gnmkdm=N305005');
    expect(TEACHER_PAGE_URL).toContain('cjcx/cjcx_cxDgXscj.html');
    expect(TEACHER_PAGE_URL).toContain('doType=query');
    expect(TEACHER_PAGE_URL).toContain('gnmkdm=N305005');
  });

  it('signs in through the education system CAS service', () => {
    expect(CAS_SIGN_IN_URL).toBe(
      'https://cas.whu.edu.cn/authserver/login?service=https%3A%2F%2Fjwgl.whu.edu.cn%2Fsso%2Fjznewsixlogin',
    );
  });

  it('recognises arrival by the page title, not by a token', () => {
    // The SSO redirect returns no token, so the title is the only signal there
    // is. It is the same string `loginEducation` looks for in a body, so the
    // two paths agree on what "signed in" means.
    expect(EDUCATION_HOME_TITLE).toBe('教学管理信息服务平台');
  });
});
