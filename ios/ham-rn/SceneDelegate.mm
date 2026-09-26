#import "SceneDelegate.h"

#import <RCTReactNativeFactory.h>

#import "AppDelegate.h"

static NSString *const kHamModuleName = @"Ham";

@implementation SceneDelegate

- (void)scene:(UIScene *)scene
    willConnectToSession:(UISceneSession *)session
                 options:(UISceneConnectionOptions *)connectionOptions
{
  if (![scene isKindOfClass:UIWindowScene.class]) {
    return;
  }

  AppDelegate *appDelegate = (AppDelegate *)UIApplication.sharedApplication.delegate;
  RCTReactNativeFactory *factory = appDelegate.reactNativeFactory;
  if (factory == nil) {
    // application:didFinishLaunchingWithOptions: always runs before a scene
    // connects. If it somehow did not, leave the scene empty rather than
    // building a root view with no dependency provider behind it.
    return;
  }

  self.window = [[UIWindow alloc] initWithWindowScene:(UIWindowScene *)scene];

  // Builds the root view, wraps it in a fresh UIViewController, installs it on
  // the window above and calls makeKeyAndVisible.
  //
  // launchOptions is nil on purpose: it is an NSDictionary, and under the
  // UIScene lifecycle the application:didFinishLaunchingWithOptions: dictionary
  // this used to be forwarded from is always empty anyway. Incoming URL and
  // notification contexts arrive through scene:openURLContexts: and
  // scene:continueUserActivity: instead.
  [factory startReactNativeWithModuleName:kHamModuleName
                                inWindow:self.window
                       initialProperties:appDelegate.initialProps
                           launchOptions:nil];
}

@end
