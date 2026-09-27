import React, {useCallback, useMemo, useRef, useState} from 'react';
import {WebView} from 'react-native-webview';
import {StyleSheet, Text, View} from 'react-native';
import type {StyleProp, ViewStyle} from 'react-native';
import {buildScoreHookScript, parsePageMessage} from './scoreHook';
import type {PageMessage} from './scoreHook';
import {useColor} from '@/utils/color/color';
import {useWebViewStyle} from '@/components/cas/style';

/**
 * Drives the education system's own pages and hands back what they reply.
 *
 * The sign-in runs *inside the WebView*, not over `fetch`, and that is the whole
 * design. The education SSO establishes its session through the redirect
 * response, and on iOS a WebView's `WKHTTPCookieStore` is a different store from
 * the one `fetch` writes to. Handing the cookie over by hand would mean reading a
 * `Set-Cookie` header the Fetch specification hides from JavaScript. Leaving the
 * exchange in the browser context, where it already works, means the app never
 * holds the education session at all: the WebView brings the CAS cookie from the
 * sign-in, CAS redirects without asking for a password again, and the education
 * session exists only as a cookie in the view.
 *
 * The student score page and the teacher grade-entry page are the same page --
 * same path, same `gnmkdm` (`N305005`) -- branched by a hidden `jsxx` field the
 * server sets from the account's role. So this one component drives both, and
 * which one you get follows from the account that signed in.
 */

/** The page both roles use. `doType=query` is what the teacher view adds. */
const SCORE_PAGE_URL =
  'https://jwgl.whu.edu.cn/cjcx/cjcx_cxDgXscj.html?gnmkdm=N305005';
const TEACHER_PAGE_URL =
  'https://jwgl.whu.edu.cn/cjcx/cjcx_cxDgXscj.html?doType=query&gnmkdm=N305005';

/** The education system's CAS service, as the app already registers it. */
const EDUCATION_SSO_SERVICE =
  'https%3A%2F%2Fjwgl.whu.edu.cn%2Fsso%2Fjznewsixlogin';

const CAS_SIGN_IN_URL = `https://cas.whu.edu.cn/authserver/login?service=${EDUCATION_SSO_SERVICE}`;

/**
 * How arrival at the education system is recognised.
 *
 * The SSO redirect returns no token, so the only signal is the page itself: its
 * title. This is the same string `loginEducation` already looks for in the
 * response body, so the two paths agree on what "signed in" means.
 */
const EDUCATION_HOME_TITLE = '教学管理信息服务平台';

const isEducationUrl = (url: string): boolean => {
  try {
    return new URL(url).hostname.toLowerCase() === 'jwgl.whu.edu.cn';
  } catch {
    return false;
  }
};

const EducationPageView = ({
  notice,
  onResult,
  onUnavailable,
  onNeedsCaptcha,
  pageUrl = SCORE_PAGE_URL,
  targets,
  style,
  testID,
}: {
  /** Shown above the page, so the user knows what to do there. */
  notice: string;
  /** A JSON reply, with the endpoint that produced it. */
  onResult: (result: {body: string; url: string}) => void;
  onUnavailable?: (url: string) => void;
  onNeedsCaptcha?: (required: boolean) => void;
  pageUrl?: string;
  /** Path fragments whose replies to read. */
  targets: string[];
  style?: StyleProp<ViewStyle>;
  testID?: string;
}): React.JSX.Element => {
  const color = useColor();
  const webViewStyle = useWebViewStyle();
  const [hasArrived, setHasArrived] = useState(false);
  const isSignedInRef = useRef(false);
  const hook = useMemo(() => buildScoreHookScript(targets), [targets]);

  const handleNavigation = useCallback(
    (state: {title: string; url: string}) => {
      if (
        !isSignedInRef.current &&
        state.title.includes(EDUCATION_HOME_TITLE) &&
        isEducationUrl(state.url)
      ) {
        isSignedInRef.current = true;
        setHasArrived(true);
      }
    },
    [],
  );

  const handleMessage = useCallback(
    (event: {nativeEvent: {data: unknown}}) => {
      const message: PageMessage | undefined = parsePageMessage(
        event.nativeEvent.data,
      );
      if (!message) {
        return;
      }
      if (message.type === 'result') {
        onResult({body: message.body, url: message.url});
      } else if (message.type === 'captcha') {
        onNeedsCaptcha?.(message.required);
      } else {
        onUnavailable?.(message.url);
      }
    },
    [onNeedsCaptcha, onResult, onUnavailable],
  );

  const source = useMemo(
    () => ({uri: hasArrived ? pageUrl : CAS_SIGN_IN_URL}),
    [hasArrived, pageUrl],
  );

  return (
    <View style={[styles.container, {backgroundColor: color.ham_bg_b1}, style]}>
      {hasArrived ? (
        <View style={[styles.notice, {backgroundColor: color.ham_lightBlue}]}>
          <Text style={[styles.noticeText, {color: color.ham_text_secondary}]}>
            {notice}
          </Text>
        </View>
      ) : null}
      <WebView
        testID={testID ?? 'education-page-webview'}
        source={source}
        style={StyleSheet.flatten([webViewStyle, styles.webView])}
        injectedJavaScriptBeforeContentLoaded={hook}
        onMessage={handleMessage}
        onNavigationStateChange={handleNavigation}
        // Left off: these are the university's own pages and there is nothing in
        // them to inspect from here. The hook reports what matters.
        webviewDebuggingEnabled={false}
        originWhitelist={['https://*']}
      />
    </View>
  );
};

/** Re-exported so the notice styling has one home. */
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  notice: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  noticeText: {
    fontSize: 12,
    lineHeight: 18,
  },
  webView: {
    flex: 1,
  },
});

export {
  CAS_SIGN_IN_URL,
  EDUCATION_HOME_TITLE,
  EducationPageView,
  SCORE_PAGE_URL,
  TEACHER_PAGE_URL,
};
export default EducationPageView;
