package com.nowcent.ham.rndebug.module

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.nowcent.ham.rn.nativemodule.NativeCasMobileLoginModuleSpec

/**
 * @author orangeboyChen
 * @version 1.0
 * @date 2026/1/21 01:28
 */
class RNCasMobileLoginModule(reactContext: ReactApplicationContext) :
    NativeCasMobileLoginModuleSpec(reactContext) {

    override fun onLoginSuccess(cookie: String, promise: Promise) {
        if (cookie.isEmpty()) {
            promise.resolve(false)
            return
        }
        casCookie = cookie
        promise.resolve(true)
    }
}
