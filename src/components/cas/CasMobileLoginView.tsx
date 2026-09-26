import React, {useCallback, useEffect, useRef, useState} from 'react';
import {WebView} from 'react-native-webview';
import {
  Alert,
  Button,
  Linking,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {StyleProp, ViewStyle} from 'react-native';
import CasMobileLoginModule from '@/modules/NativeCasMobileLoginModule';
import '@/i18n/i18n';
import {useTranslation} from 'react-i18next';
import type {Cookies} from '@preeternal/react-native-cookie-manager';
import CookieManager from '@preeternal/react-native-cookie-manager';
import {useWebViewStyle} from '@/components/cas/style';

/**
 * @author orangeboyChen
 * @version 1.0
 * @date 2024/7/15 18:10
 */

const buildInjectedScript = (
  studentIdPlaceholder: string,
  invalidStudentIdMessage: string,
  passwordPlaceholder: string,
  loginButtonText: string,
  rememberMeLabelText: string,
  universityNameText: string,
  privacyAgreementTip: string,
  accountExpiredTip: string,
  invalidUsernamePasswordTip: string,
) => `
   const socialAutoLoginElement = document.getElementsByClassName('social-aut-login')[0];
   if (socialAutoLoginElement) {
       socialAutoLoginElement.remove();
   }
   const combineOptionsFooter = document.getElementsByClassName('combine_options_footer')[0];
   if (combineOptionsFooter) {
       combineOptionsFooter.remove();
   }
   document.querySelectorAll('.ge-wrapper-footer, .wjmm').forEach(element => element.remove());
   const passwordLoginForm = document.querySelector('form#pwdFromId');
   const usernameElement = passwordLoginForm?.querySelector('#username');
   const passwordElement = passwordLoginForm?.querySelector('#password');
   const loginElement = passwordLoginForm?.querySelector('#login_submit');
   if (!usernameElement || !passwordElement || !loginElement) {
       true;
   } else {

   usernameElement.setAttribute('placeholder', ${JSON.stringify(
     studentIdPlaceholder,
   )});
   passwordElement.setAttribute('placeholder', ${JSON.stringify(
     passwordPlaceholder,
   )});
   const originalLoginHandler = loginElement.onclick;
   loginElement.onclick = function (event) {
       if (usernameElement.value.length !== 13 && usernameElement.value.length !== 8) {
           utils.alertBox(${JSON.stringify(invalidStudentIdMessage)});
           return false;
       }
       return originalLoginHandler.call(this, event);
   };
   if (loginElement) {
       const loginIcon = loginElement.querySelector('img, i');
       const loginIconClone = loginIcon ? loginIcon.cloneNode(true) : null;
       loginElement.textContent = '';
       if (loginIconClone) {
           loginElement.appendChild(loginIconClone);
       }
       loginElement.appendChild(document.createTextNode(' ' + ${JSON.stringify(
         loginButtonText,
       )}));
   }
   
   if (document.getElementsByClassName('main') && document.getElementsByClassName('main').length) {
       document.getElementsByClassName('main')[0].setAttribute('style', \`height: ${'$'}{window.innerHeight}px\`);
   }
   const rememberMeText = passwordLoginForm.querySelector('#myRememberMe .change-color');
   if (rememberMeText) {
       rememberMeText.textContent = ${JSON.stringify(rememberMeLabelText)};
   }
   document.querySelectorAll('#retrievePassPwdId, #retrievePassId').forEach(element => element.remove());
   const languageWrap = document.getElementById('languages') || document.querySelector('.language-wrap');
   if (languageWrap) {
       languageWrap.style.display = 'none';
   }
   const headerElement = document.querySelector('header');
   if (headerElement) {
       headerElement.textContent = ${JSON.stringify(universityNameText)};
   }
   function extractShowTipsText(input) {
       if (typeof input === 'string') {
           return input.trim();
       }
       if (input && typeof input.textContent === 'string') {
           return input.textContent.trim();
       }
       if (input && typeof input.innerText === 'string') {
           return input.innerText.trim();
       }
       if (input && typeof input.innerHTML === 'string') {
           return input.innerHTML.replace(/<[^>]*>/g, '').trim();
       }
       return '';
   }
   function overrideShowTips() {
       if (typeof showTips !== 'function' || showTips.__hamWrapped) {
           return false;
       }
       const originalShowTips = showTips;
       const wrappedShowTips = (input) => {
           const text = extractShowTipsText(input);
           if (text === '请先阅读并同意隐私协议!') {
               originalShowTips(${JSON.stringify(privacyAgreementTip)});
               return;
           }
           if (text.includes('该帐号已经过期')) {
               originalShowTips(${JSON.stringify(accountExpiredTip)});
               return;
           }
           if (text.includes('您提供的用户名或者密码有误')) {
               originalShowTips(${JSON.stringify(invalidUsernamePasswordTip)});
               return;
           }
           originalShowTips(typeof input === 'string' ? input : text);
       };
       wrappedShowTips.__hamWrapped = true;
       showTips = wrappedShowTips;
       return true;
   }
   if (!overrideShowTips()) {
       const interval = setInterval(() => {
           if (overrideShowTips()) {
               clearInterval(interval);
           }
       }, 200);
       setTimeout(() => clearInterval(interval), 2000);
   }
   }
true;
`;

const CAS_AUTH_SERVER = 'https://cas.whu.edu.cn/authserver';
const CAS_MOBILE_LOGIN_URL = `${CAS_AUTH_SERVER}/mobile/auth?appId=985180443`;
const CAS_MOBILE_SUCCESS_PATH = '/mobile/default.html';
const PRIVACY_POLICY_URL =
  'https://homewh.chaoxing.com/agree/privacyPolicy?appId=1000028';

const decodeUrl = (url: string) => {
  try {
    return decodeURIComponent(url);
  } catch {
    return url;
  }
};

const extractMobileToken = (url: string) => {
  try {
    const parsed = new URL(decodeUrl(url));
    if (
      parsed.protocol !== 'https:' ||
      parsed.hostname.toLowerCase() !== 'cas.whu.edu.cn' ||
      !parsed.pathname.endsWith(CAS_MOBILE_SUCCESS_PATH)
    ) {
      return undefined;
    }
    return parsed.searchParams.get('mobile_token') || undefined;
  } catch {
    return undefined;
  }
};

const buildCookieHeader = (cookies: Cookies) =>
  Object.keys(cookies)
    .map(key => `${key}=${cookies[key].value}`)
    .join(';');

function CasMobileLoginView({
  onLoginSuccess,
  style,
}: {
  onLoginSuccess?: () => void;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  const {t} = useTranslation();
  const isLoginCompleteRef = useRef(false);
  const isLoginPendingRef = useRef(false);
  const webViewStyle = useWebViewStyle();
  const [cookieClearFailed, setCookieClearFailed] = useState(false);
  const [cookiesCleared, setCookiesCleared] = useState(false);

  const clearCookies = useCallback((): void => {
    setCookieClearFailed(false);
    setCookiesCleared(false);
    void CookieManager.clearAll(true)
      .then(cleared => {
        if (cleared) {
          setCookiesCleared(true);
        } else {
          setCookieClearFailed(true);
        }
      })
      .catch(() => setCookieClearFailed(true));
  }, []);

  const showLoginFailure = useCallback((): void => {
    isLoginPendingRef.current = false;
    Alert.alert(t('app.login_failure_title'), t('app.login_failure_message'), [
      {text: t('app.retry'), onPress: clearCookies},
      {style: 'cancel', text: t('app.cancel')},
    ]);
  }, [clearCookies, t]);

  useEffect(() => {
    clearCookies();
  }, [clearCookies]);

  if (!cookiesCleared) {
    return (
      <View
        style={[
          StyleSheet.flatten([webViewStyle, style]),
          styles.statusContainer,
        ]}>
        {cookieClearFailed ? (
          <>
            <Text style={styles.statusText}>
              {t('app.cookie_clear_failed')}
            </Text>
            <Button
              onPress={clearCookies}
              testID="cookie-clear-retry"
              title={t('app.retry')}
            />
          </>
        ) : (
          <Text style={styles.statusText}>{t('app.loading')}</Text>
        )}
      </View>
    );
  }

  return (
    <WebView
      injectedJavaScript={buildInjectedScript(
        t('cas.student_id_placeholder'),
        t('cas.invalid_student_id'),
        t('cas.password_placeholder'),
        t('cas.login_button'),
        t('cas.remember_me'),
        t('cas.university_name'),
        t('cas.privacy_agreement_tip'),
        t('cas.account_expired_tip'),
        t('cas.invalid_username_or_password_tip'),
      )}
      onShouldStartLoadWithRequest={request => {
        const mobileToken = extractMobileToken(request.url);
        if (
          mobileToken &&
          !isLoginCompleteRef.current &&
          !isLoginPendingRef.current
        ) {
          isLoginPendingRef.current = true;

          const cookieHandler = (cookies: Cookies) => {
            const cookie = buildCookieHeader(cookies);
            if (!cookie) {
              showLoginFailure();
              return;
            }
            void CasMobileLoginModule.onLoginSuccess(cookie)
              .then(stored => {
                isLoginPendingRef.current = false;
                if (stored) {
                  isLoginCompleteRef.current = true;
                  onLoginSuccess?.();
                } else {
                  showLoginFailure();
                }
              })
              .catch(showLoginFailure);
          };

          if (Platform.OS === 'ios') {
            void CookieManager.getAll(true)
              .then(allCookie => {
                const cookie: Cookies = {};
                Object.keys(allCookie)
                  .filter(key => {
                    const domain = allCookie[key].domain
                      .replace(/^\./, '')
                      .toLowerCase();
                    return (
                      domain === 'cas.whu.edu.cn' ||
                      domain.endsWith('.cas.whu.edu.cn')
                    );
                  })
                  .forEach(key => {
                    cookie[key] = allCookie[key];
                  });
                cookieHandler(cookie);
              })
              .catch(showLoginFailure);
          } else if (Platform.OS === 'android') {
            void CookieManager.get(CAS_AUTH_SERVER)
              .then(cookies => cookieHandler(cookies))
              .catch(showLoginFailure);
          }
          return false;
        }

        if (request.url === PRIVACY_POLICY_URL) {
          void Linking.openURL(request.url);
          return false;
        }
        return true;
      }}
      source={{
        uri: CAS_MOBILE_LOGIN_URL,
      }}
      style={StyleSheet.flatten([webViewStyle, style])}
      webviewDebuggingEnabled={false}
    />
  );
}

const styles = StyleSheet.create({
  statusContainer: {
    alignItems: 'center',
    gap: 14,
    justifyContent: 'center',
    padding: 24,
  },
  statusText: {
    fontSize: 14,
    textAlign: 'center',
  },
});

export default CasMobileLoginView;
