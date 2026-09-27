#import <RNNativeModuleSpec/RNNativeModuleSpec.h>
#import <UIKit/UIKit.h>

@interface RNNativeCommonModule : NativeCommonModuleSpecBase <NativeCommonModuleSpec>
@end

@implementation RNNativeCommonModule

RCT_EXPORT_MODULE(NativeCommonModule)

- (void)openUrl:(NSString *)url {
  NSURL *target = [NSURL URLWithString:url];
  NSSet<NSString *> *allowedSchemes = [NSSet setWithArray:@[@"http", @"https", @"mailto", @"tel"]];
  if (target == nil || ![allowedSchemes containsObject:target.scheme.lowercaseString]) {
    return;
  }
  dispatch_async(dispatch_get_main_queue(), ^{
    [UIApplication.sharedApplication openURL:target options:@{} completionHandler:nil];
  });
}

- (void)showToast:(NSString *)type
          message:(NSString *)message
             hint:(NSString *)hint {
  (void)hint;
  dispatch_async(dispatch_get_main_queue(), ^{
    UIWindow *window = nil;
    for (UIScene *scene in UIApplication.sharedApplication.connectedScenes) {
      if ([scene isKindOfClass:UIWindowScene.class]) {
        window = ((UIWindowScene *)scene).keyWindow;
        if (window != nil) {
          break;
        }
      }
    }
    UIViewController *presenter = window.rootViewController;
    while (presenter.presentedViewController != nil) {
      presenter = presenter.presentedViewController;
    }
    if (![presenter isKindOfClass:UIViewController.class]) {
      return;
    }
    NSString *title = [type isEqualToString:@"error"] ? @"Error" : @"Ham";
    UIAlertController *alert = [UIAlertController alertControllerWithTitle:title
                                                                     message:message
                                                              preferredStyle:UIAlertControllerStyleAlert];
    [alert addAction:[UIAlertAction actionWithTitle:@"OK" style:UIAlertActionStyleDefault handler:nil]];
    [presenter presentViewController:alert animated:YES completion:nil];
  });
}

- (NSString *)getLocale {
  NSString *language = NSLocale.preferredLanguages.firstObject.lowercaseString ?: @"zh";
  if ([language hasPrefix:@"zh"]) {
    return @"zh";
  }
  if ([language hasPrefix:@"ja"]) {
    return @"ja";
  }
  if ([language hasPrefix:@"en"]) {
    return @"en";
  }
  return @"zh";
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeCommonModuleSpecJSI>(params);
}

@end
