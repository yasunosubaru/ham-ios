#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

/// Hosts the React Native root view in the window UIKit hands us.
///
/// The window deliberately does not live on AppDelegate: apps built with the
/// iOS 26 SDK and later refuse to launch unless they adopt the UIScene
/// lifecycle, so UIKit creates the UIWindowScene and calls us instead.
@interface SceneDelegate : UIResponder <UIWindowSceneDelegate>

@property (nonatomic, strong, nullable) UIWindow *window;

@end

NS_ASSUME_NONNULL_END
