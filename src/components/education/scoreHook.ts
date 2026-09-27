/**
 * The script injected into the education system's own pages, and the parser for
 * what it sends back.
 *
 * Why the pages are driven rather than called over HTTP:
 *
 * The student score page gates its own query behind a captcha.
 *
 *   if ((sfxyyzm == "1" || sfxyyzm == "2") && jsxx == "xs") popupCaptcha(...)
 *   else searchData()
 *
 * and the request carries whatever the vendor's callback put into `validate`:
 *
 *   requestMap["validate"] = $("#validate").val()
 *
 * That value comes from a real interaction with the vendor's widget -- 顶象
 * (`zfdunCaptcha`) or 网易 (`initNECaptcha`), depending on the instance. A
 * fabricated `validate` is not accepted, and forging one is not something this
 * app does: the captcha is the university's anti-automation measure and the user
 * solves it themselves, in the university's own page.
 *
 * So the page makes the request, with a token this app never had to know, and
 * the only thing taken from it is the reply. The user is not spared the captcha;
 * they are spared only the manual reading of a table.
 *
 * On the teacher side the same page and the same `gnmkdm` (`N305005`) are used,
 * branched by a hidden `jsxx` field the server sets from the account's role, and
 * every one of the three captcha checks carries `&& jsxx == "xs"`. A teacher
 * account therefore never meets the captcha -- which is the university's own
 * arrangement, not a hole this app looks for.
 */

/** Endpoints whose JSON replies are worth reading, as path fragments. */
const DEFAULT_TARGETS = ['cjcx_cxXsgrcj'];

/**
 * Builds the hook for a given set of path fragments.
 *
 * Matching on fragments rather than one fixed path is deliberate: the teacher
 * grade-entry endpoints could not be enumerated without a session (every `.html`
 * on the host answers `302` to the login page whether or not it exists), so
 * which ones the grade-entry screen reads is discovered the first time a teacher
 * runs it rather than guessed now.
 */
const buildScoreHookScript = (targets: string[] = DEFAULT_TARGETS): string => `
(function () {
  if (window.__hamScoreHook) {
    return;
  }
  window.__hamScoreHook = true;

  var TARGETS = ${JSON.stringify(targets)};
  var REPORTED_CAPTCHA = false;

  var post = function (payload) {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    } catch (error) {
      // The bridge is absent during teardown, and there is nowhere to report
      // it: the data is still in the page either way.
    }
  };

  var open = XMLHttpRequest.prototype.open;
  var send = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this.__hamUrl = String(url);
    return open.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function () {
    var xhr = this;
    xhr.addEventListener('load', function () {
      var url = xhr.__hamUrl || '';
      var matched = false;
      for (var i = 0; i < TARGETS.length; i++) {
        if (url.indexOf(TARGETS[i]) !== -1) {
          matched = true;
          break;
        }
      }
      if (!matched) {
        return;
      }
      var text = '';
      try {
        text = xhr.responseText || '';
      } catch (error) {
        return;
      }
      if (!text) {
        return;
      }
      // The host answers 200 with an HTML page for several failures, so the
      // first character is what separates a result from a redirect to login.
      var first = text.charAt(0);
      if (first !== '{' && first !== '[') {
        post({type: 'result-unavailable', url: url});
        return;
      }
      // The URL travels with the body so the caller knows which of the endpoints
      // it is looking at, which is how the grade-entry screen tells a course
      // list from a mark-detail list without hardcoding a guess.
      post({type: 'result', url: url, body: text});
    });
    return send.apply(this, arguments);
  };

  var reportCaptcha = function () {
    if (REPORTED_CAPTCHA) {
      return;
    }
    var flag = document.getElementById('sfxyyzm');
    var role = document.getElementById('jsxx');
    if (!flag || !role) {
      return;
    }
    REPORTED_CAPTCHA = true;
    post({
      type: 'captcha',
      // Only the student view is gated. Reporting a teacher page as needing a
      // captcha would tell the user to look for something that is not there.
      required:
        (flag.value === '1' || flag.value === '2') && role.value === 'xs'
    });
  };

  document.addEventListener('DOMContentLoaded', reportCaptcha);
  window.addEventListener('load', reportCaptcha);
  // The hidden inputs are filled in by the page's own scripts after load, so
  // keep looking briefly rather than reporting on the first empty read.
  var attempts = 0;
  var timer = setInterval(function () {
    reportCaptcha();
    if (REPORTED_CAPTCHA || ++attempts > 40) {
      clearInterval(timer);
    }
  }, 250);
})();
true;
`;

/** Kept for the score screen, which has one known endpoint. */
const SCORE_HOOK_SCRIPT = buildScoreHookScript();

type PageMessage =
  /** A JSON reply, with the endpoint that produced it. */
  | {body: string; type: 'result'; url: string}
  /** That endpoint answered, but not with JSON. */
  | {type: 'result-unavailable'; url: string}
  /** Whether this page will demand a captcha from this user. */
  | {required: boolean; type: 'captcha'};

/**
 * Parses one message from the page.
 *
 * Every field is checked rather than trusted: this is a string that arrived from
 * a web page, so a malformed one has to become "nothing happened" rather than an
 * exception inside a message handler, where it would take the screen down with
 * it.
 */
const parsePageMessage = (raw: unknown): PageMessage | undefined => {
  if (typeof raw !== 'string') {
    return undefined;
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const record = value as {[key: string]: unknown};
  const type = record['type'];
  const url = record['url'];
  if (
    type === 'result' &&
    typeof record['body'] === 'string' &&
    typeof url === 'string'
  ) {
    return {body: record['body'], type: 'result', url};
  }
  if (type === 'result-unavailable' && typeof url === 'string') {
    return {type: 'result-unavailable', url};
  }
  if (type === 'captcha' && typeof record['required'] === 'boolean') {
    return {required: record['required'], type: 'captcha'};
  }
  return undefined;
};

export {
  buildScoreHookScript,
  DEFAULT_TARGETS,
  parsePageMessage,
  SCORE_HOOK_SCRIPT,
};
export type {PageMessage};
