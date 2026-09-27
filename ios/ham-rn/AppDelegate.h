#import <RCTDefaultReactNativeFactoryDelegate.h>
#import <UIKit/UIKit.h>

@class RCTReactNativeFactory;

NS_ASSUME_NONNULL_BEGIN

/// Creates and owns the React Native factory for the lifetime of the process,
/// and vends the scene configuration UIKit asks for.
///
/// RCTAppDelegate is deprecated in React Native 0.87 in favour of
/// RCTReactNativeFactory, and it also loads the window itself, which the
/// UIScene lifecycle no longer allows. Deriving from
/// RCTDefaultReactNativeFactoryDelegate keeps every default intact: the
/// architecture switches (new arch, Fabric, TurboModules, bridgeless) and the
/// TurboModule lookup that resolves codegen module names through
/// dependencyProvider.
@interface AppDelegate : RCTDefaultReactNativeFactoryDelegate <UIApplicationDelegate>

@property (nonatomic, strong, readonly, nullable) RCTReactNativeFactory *reactNativeFactory;

/// Handed to the root component by SceneDelegate.
@property (nonatomic, copy, readonly) NSDictionary *initialProps;

@end

NS_ASSUME_NONNULL_END
