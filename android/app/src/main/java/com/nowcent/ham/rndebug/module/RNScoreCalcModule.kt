package com.nowcent.ham.rndebug.module

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.nowcent.ham.rn.nativemodule.NativeScoreCalcModuleSpec

/**
 * @author orangeboyChen
 * @version 1.0
 * @date 2026/1/21 01:38
 */
class RNScoreCalcModule(reactContext: ReactApplicationContext) :
    NativeScoreCalcModuleSpec(reactContext) {

    override fun getCurrentCalc(): String = ""

    override fun selectCalc(item: ReadableMap): Boolean = true

    override fun openDetail(item: ReadableMap) {
        // The standalone calculator is implemented in React Native.
    }

    override fun testItem(item: ReadableMap): Boolean = true
}
