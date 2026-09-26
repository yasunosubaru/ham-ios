package com.nowcent.ham.rndebug.module

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.WritableNativeMap
import com.nowcent.ham.rn.nativemodule.NativeEducationModuleSpec
import java.util.Calendar

/**
 * @author orangeboyChen
 * @version 1.0
 * @date 2026/1/21 01:25
 */
class RNEducationModule(reactContext: ReactApplicationContext) :
    NativeEducationModuleSpec(reactContext) {

    override fun onGetCourseList(
        courseList: ReadableArray?,
        courseGridEntity: ReadableArray?,
        errorMessage: String?
    ) {
        // Course data is delivered to the React layer and is never logged.
    }

    override fun getCourseConfig(): WritableMap {
        val calendar = Calendar.getInstance()
        val year = calendar.get(Calendar.YEAR)
        val month = calendar.get(Calendar.MONTH) + 1
        val academicYear = if (month >= 8) year else year - 1
        val semester = if (month >= 8) 1 else 2
        return WritableNativeMap().apply {
            putInt("year", academicYear)
            putInt("semester", semester)
        }
    }

    override fun onGetScoreList(
        scoreListStr: String,
        userInfoStr: String,
        errorMessage: String?
    ) {
        // Score data is delivered to the React layer and is never logged.
    }
}
