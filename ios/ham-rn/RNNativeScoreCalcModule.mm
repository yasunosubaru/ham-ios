#import <RNNativeModuleSpec/RNNativeModuleSpec.h>

@interface RNNativeScoreCalcModule : NativeScoreCalcModuleSpecBase <NativeScoreCalcModuleSpec>
@end

@implementation RNNativeScoreCalcModule

RCT_EXPORT_MODULE(NativeScoreCalcModule)

- (NSString *)getCurrentCalc {
  return @"";
}

- (NSNumber *)selectCalc:(JS::NativeScoreCalcModule::ScoreCalcItem &)item {
  (void)item;
  return @YES;
}

- (void)openDetail:(JS::NativeScoreCalcModule::ScoreCalcItem &)item {
  (void)item;
}

- (NSNumber *)testItem:(JS::NativeScoreCalcModule::ScoreCalcItem &)item {
  (void)item;
  return @YES;
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeScoreCalcModuleSpecJSI>(params);
}

@end
