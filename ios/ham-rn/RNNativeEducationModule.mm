#import <RNNativeModuleSpec/RNNativeModuleSpec.h>

@interface RNNativeEducationModule : NativeEducationModuleSpecBase <NativeEducationModuleSpec>
@end

@implementation RNNativeEducationModule

RCT_EXPORT_MODULE(NativeEducationModule)

- (void)onGetCourseList:(NSArray *)courseList
       courseGridEntity:(NSArray *)courseGridEntity
           errorMessage:(NSString * _Nullable)errorMessage
{
  (void)courseList;
  (void)courseGridEntity;
  (void)errorMessage;
}

- (void)onGetScoreList:(NSString *)scoreList
              userInfo:(NSString *)userInfo
          errorMessage:(NSString * _Nullable)errorMessage
{
  (void)scoreList;
  (void)userInfo;
  (void)errorMessage;
}

- (NSDictionary *)getCourseConfig {
  NSDate *now = [NSDate date];
  NSCalendar *calendar = [NSCalendar currentCalendar];
  NSDateComponents *components = [calendar components:NSCalendarUnitYear | NSCalendarUnitMonth
                                             fromDate:now];
  NSInteger calendarYear = components.year;
  NSInteger month = components.month;
  NSInteger academicYear = month >= 8 ? calendarYear : calendarYear - 1;
  NSInteger semester = month >= 8 ? 1 : 2;
  return @{
    @"year": @(academicYear),
    @"semester": @(semester),
  };
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeEducationModuleSpecJSI>(params);
}

@end
