#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <React/RCTLinkingManager.h>
#import <ReactAppDependencyProvider/RCTAppDependencyProvider.h>

@implementation AppDelegate

@synthesize reactNativeFactory = _reactNativeFactory;
@synthesize initialProps = _initialProps;

- (BOOL)application:(UIApplication *)application
    didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  // The dependency provider carries the codegen module map that the factory
  // delegate uses to resolve TurboModules, so it has to be in place before the
  // factory builds its root view factory.
  self.dependencyProvider = [RCTAppDependencyProvider new];

  NSString *version = [NSBundle.mainBundle objectForInfoDictionaryKey:@"CFBundleShortVersionString"] ?: @"";
  NSString *build = [NSBundle.mainBundle objectForInfoDictionaryKey:@"CFBundleVersion"] ?: @"";
  _initialProps = @{
    @"appVersion": version,
    @"buildNumber": build,
  };

  _reactNativeFactory = [[RCTReactNativeFactory alloc] initWithDelegate:self];

  return YES;
}

#pragma mark - UIScene

- (UISceneConfiguration *)application:(UIApplication *)application
    configurationForConnectingSceneSession:(UISceneSession *)connectingSceneSession
                                   options:(UISceneConnectionOptions *)options
{
  UISceneConfiguration *configuration = [[UISceneConfiguration alloc] initWithName:@"Default Configuration"
                                                                         sessionRole:connectingSceneSession.role];
  configuration.delegateClass = NSClassFromString(@"SceneDelegate");
  return configuration;
}

#pragma mark - RCTReactNativeFactoryDelegate

- (NSURL *)bundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index.debug"];
#else
  return [NSBundle.mainBundle URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

// RCTDefaultReactNativeFactoryDelegate raises from here. Bridgeless mode does
// not call it, but the legacy bridge path does, so keep it consistent with
// bundleURL rather than leaving a trap.
- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}

#pragma mark - Linking

- (BOOL)application:(UIApplication *)application
            openURL:(NSURL *)url
            options:(NSDictionary<UIApplicationOpenURLOptionsKey, id> *)options
{
  return [RCTLinkingManager application:application openURL:url options:options];
}

- (BOOL)application:(UIApplication *)application
    continueUserActivity:(NSUserActivity *)userActivity
      restorationHandler:(void (^)(NSArray<id<UIUserActivityRestoring>> *))restorationHandler
{
  return [RCTLinkingManager application:application
                  continueUserActivity:userActivity
                    restorationHandler:restorationHandler];
}

@end
