/**
 * Debug-only entry point for the native development shells and Maestro E2E.
 * Production archives load index.js and never include these registrations.
 *
 * @format
 */

import {AppRegistry} from 'react-native';
import HamApp from './src/app/HamApp';
import CasMobileLogin from './src/components/cas/CasMobileLoginView';
import Common from './src/components/common/Common';
import FetchCourseView from './src/components/education/course/FetchCourseView';
import FetchPostGraduateCourseView from './src/components/education/course/FetchPostGraduateCourseView';
import FetchScoreView from './src/components/education/score/FetchScoreView';
import ScoreCalcView from './src/components/scorecalc/ScoreCalcView';
import BatchedBridge from 'react-native/Libraries/BatchedBridge/BatchedBridge';
import {educationCallableModule} from '@/business/education/module';
import {entries as courseImportEntries} from './src/e2e/courseImportEntries';

AppRegistry.registerComponent('Ham', () => HamApp);
AppRegistry.registerComponent('RNCasMobileLogin', () => CasMobileLogin);
AppRegistry.registerComponent('RNCommon', () => Common);
AppRegistry.registerComponent('RNFetchCourseView', () => FetchCourseView);
AppRegistry.registerComponent(
  'RNFetchPostGraduateCourseView',
  () => FetchPostGraduateCourseView,
);
AppRegistry.registerComponent('RNFetchScoreView', () => FetchScoreView);
AppRegistry.registerComponent('RNScoreCalcView', () => ScoreCalcView);
AppRegistry.registerComponent(
  'RNFetchCourseViewE2E',
  () => courseImportEntries.Partial,
);
Object.entries(courseImportEntries).forEach(([suffix, Entry]) => {
  AppRegistry.registerComponent(`RNFetchCourseViewE2E${suffix}`, () => Entry);
});
BatchedBridge.registerCallableModule(
  'RNEducationCallable',
  educationCallableModule,
);
