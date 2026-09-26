#import <RNNativeModuleSpec/RNNativeModuleSpec.h>
#import <WebKit/WebKit.h>
#import "RNCasSession.h"

@interface RNNativeCasModule : NativeCasModuleSpecBase <NativeCasModuleSpec>
@end

@implementation RNNativeCasModule

RCT_EXPORT_MODULE(NativeCasModule)

- (void)clearCasCookie:(RCTPromiseResolveBlock)resolve
                 reject:(RCTPromiseRejectBlock)reject
{
  (void)reject;
  BOOL keychainCleared = RNCasClearCookie();
  NSArray<NSHTTPCookie *> *sharedCookies = NSHTTPCookieStorage.sharedHTTPCookieStorage.cookies;
  for (NSHTTPCookie *cookie in sharedCookies) {
    [NSHTTPCookieStorage.sharedHTTPCookieStorage deleteCookie:cookie];
  }
  dispatch_async(dispatch_get_main_queue(), ^{
    // WKHTTPCookieStore only deletes one cookie at a time and has no bulk
    // delete method, so clear the whole cookie data type through the website
    // data store instead.
    [WKWebsiteDataStore.defaultDataStore
      removeDataOfTypes:[NSSet setWithObject:WKWebsiteDataTypeCookies]
      modifiedSince:[NSDate dateWithTimeIntervalSince1970:0]
      completionHandler:^{
        resolve(@(keychainCleared));
      }];
  });
}

- (NSString *)requestCasCookie {
  return RNCasReadCookie();
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeCasModuleSpecJSI>(params);
}

@end
