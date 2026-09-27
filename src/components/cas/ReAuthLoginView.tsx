import {WebView} from 'react-native-webview';
import React from 'react';
import {StyleSheet} from 'react-native';
import type {StyleProp, ViewStyle} from 'react-native';
import {useWebViewStyle} from '@/components/cas/style';

const REAUTH_HOSTS = new Set(['cas.whu.edu.cn', 'jwgl.whu.edu.cn']);

const isReAuthTicketUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    const ticket = parsed.searchParams.get('ticket');
    return (
      parsed.protocol === 'https:' &&
      REAUTH_HOSTS.has(parsed.hostname.toLowerCase()) &&
      Boolean(ticket)
    );
  } catch {
    return false;
  }
};

/**
 * @author orangeboyChen
 * @version 1.0
 * @date 2026/5/13 15:11
 */
const ReAuthLoginView = ({
  reAuthUrl,
  onGetTicketUrl,
  style,
  testID,
}: {
  reAuthUrl: string;
  onGetTicketUrl: (ticketUrl: string) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}): React.ReactElement => {
  const webViewStyle = useWebViewStyle();
  return (
    <WebView
      testID={testID}
      source={{uri: reAuthUrl}}
      style={StyleSheet.flatten([webViewStyle, style])}
      webviewDebuggingEnabled={false}
      onShouldStartLoadWithRequest={request => {
        if (isReAuthTicketUrl(request.url)) {
          onGetTicketUrl(request.url);
          return false;
        }
        return true;
      }}
    />
  );
};

export {ReAuthLoginView};
