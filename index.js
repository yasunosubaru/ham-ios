/**
 * @format
 */

import {AppRegistry} from 'react-native';
import {installNobleCryptoBackend} from './src/business/library/crypto.noble';
import HamApp from './src/app/HamApp';

// The library booking service signs its requests, and signing needs AES-128-CBC
// and HMAC-SHA256 -- neither of which React Native provides. The backend is
// installed here rather than inside the screen so it is ready before the first
// request and so no component has to know which implementation is in use.
installNobleCryptoBackend();

AppRegistry.registerComponent('Ham', () => HamApp);
