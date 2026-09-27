package com.nowcent.ham.rndebug.module

import android.webkit.CookieManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UiThreadUtil
import com.nowcent.ham.rn.nativemodule.NativeCasModuleSpec

/**
 * @author orangeboyChen
 * @version 1.0
 * @date 2026/1/21 01:29
 */
var casCookie: String = ""

class RNCasModule(reactContext: ReactApplicationContext) :
    NativeCasModuleSpec(reactContext) {

    override fun clearCasCookie(promise: Promise) {
        casCookie = ""
        UiThreadUtil.runOnUiThread {
            val cookieManager = CookieManager.getInstance()
            cookieManager.removeAllCookies {
                cookieManager.flush()
                promise.resolve(true)
            }
        }
    }

    override fun requestCasCookie(): String = casCookie
}
