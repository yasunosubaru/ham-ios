#import <RNNativeModuleSpec/RNNativeModuleSpec.h>
#import <React/RCTLog.h>
#import <Security/Security.h>
#import "RNCasSession.h"

static NSString * const RNCasKeychainService = @"cn.nowcent.ham.cas";
static NSString * const RNCasKeychainAccount = @"cas-session";

static NSMutableDictionary *RNCasKeychainQuery(void)
{
  return [@{
    (__bridge id)kSecClass: (__bridge id)kSecClassGenericPassword,
    (__bridge id)kSecAttrService: RNCasKeychainService,
    (__bridge id)kSecAttrAccount: RNCasKeychainAccount,
  } mutableCopy];
}

BOOL RNCasStoreCookie(NSString *cookie)
{
  if (cookie.length == 0) {
    return NO;
  }

  NSData *cookieData = [cookie dataUsingEncoding:NSUTF8StringEncoding];
  if (cookieData == nil) {
    return NO;
  }

  NSMutableDictionary *query = RNCasKeychainQuery();
  NSDictionary *attributes = @{
    (__bridge id)kSecValueData: cookieData,
    (__bridge id)kSecAttrAccessible: (__bridge id)kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
  };

  OSStatus status = SecItemUpdate(
    (__bridge CFDictionaryRef)query,
    (__bridge CFDictionaryRef)attributes);
  if (status == errSecItemNotFound) {
    [query addEntriesFromDictionary:attributes];
    status = SecItemAdd((__bridge CFDictionaryRef)query, NULL);
  }
  if (status != errSecSuccess) {
    RCTLogError(@"Failed to store the CAS session in Keychain (status=%d)", status);
    return NO;
  }
  return YES;
}

NSString *RNCasReadCookie(void)
{
  NSMutableDictionary *query = RNCasKeychainQuery();
  query[(__bridge id)kSecReturnData] = @YES;
  query[(__bridge id)kSecMatchLimit] = (__bridge id)kSecMatchLimitOne;

  CFTypeRef result = NULL;
  OSStatus status = SecItemCopyMatching((__bridge CFDictionaryRef)query, &result);
  if (status == errSecItemNotFound) {
    return @"";
  }
  if (status != errSecSuccess) {
    RCTLogError(@"Failed to read the CAS session from Keychain (status=%d)", status);
    return @"";
  }

  NSData *data = CFBridgingRelease(result);
  return [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding] ?: @"";
}

BOOL RNCasClearCookie(void)
{
  OSStatus status = SecItemDelete((__bridge CFDictionaryRef)RNCasKeychainQuery());
  if (status == errSecSuccess || status == errSecItemNotFound) {
    return YES;
  }
  RCTLogError(@"Failed to clear the CAS session from Keychain (status=%d)", status);
  return NO;
}

@interface RNNativeCasMobileLoginModule : NativeCasMobileLoginModuleSpecBase <NativeCasMobileLoginModuleSpec>
@end

@implementation RNNativeCasMobileLoginModule

RCT_EXPORT_MODULE(NativeCasMobileLoginModule)

- (void)onLoginSuccess:(NSString *)cookie
                resolve:(RCTPromiseResolveBlock)resolve
                 reject:(RCTPromiseRejectBlock)reject
{
  (void)reject;
  resolve(@(RNCasStoreCookie(cookie)));
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeCasMobileLoginModuleSpecJSI>(params);
}

@end
