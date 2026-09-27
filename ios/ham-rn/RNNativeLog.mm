#import <RNNativeModuleSpec/RNNativeModuleSpec.h>

@interface RNNativeLog : NativeLogSpecBase <NativeLogSpec>
@end

@implementation RNNativeLog

RCT_EXPORT_MODULE(NativeLog)

- (void)i:(NSString *)tag
  message:(NSString *)message
{
  (void)tag;
  (void)message;
#if DEBUG
  NSLog(@"[ReactNative][%@] %@", tag, message);
#endif
}

- (void)e:(NSString *)tag
  message:(NSString *)message
{
  (void)tag;
  (void)message;
#if DEBUG
  NSLog(@"[ReactNative][ERROR][%@] %@", tag, message);
#endif
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeLogSpecJSI>(params);
}

@end
