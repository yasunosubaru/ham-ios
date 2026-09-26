package com.nowcent.ham.rndebug.module

import android.content.Intent
import android.net.Uri
import android.widget.Toast
import com.facebook.react.bridge.ReactApplicationContext
import com.nowcent.ham.rn.nativemodule.NativeCommonModuleSpec
import java.util.Locale

/**
 * @author orangeboyChen
 * @version 1.0
 * @date 2026/1/21 01:42
 */
class RNCommonModule(
    private val reactContext: ReactApplicationContext
) : NativeCommonModuleSpec(reactContext) {

    override fun openUrl(url: String) {
        val target = Uri.parse(url)
        val scheme = target.scheme?.lowercase(Locale.ROOT)
        if (scheme !in setOf("http", "https", "mailto", "tel")) {
            return
        }
        try {
            reactContext.startActivity(
                Intent(Intent.ACTION_VIEW, target)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            )
        } catch (_: RuntimeException) {
            // The host may have no activity capable of handling the scheme.
        }
    }

    override fun showToast(type: String, message: String, hint: String) {
        Toast.makeText(reactContext.applicationContext, message, Toast.LENGTH_LONG).show()
    }

    override fun getLocale(): String {
        return Locale.getDefault().language.lowercase(Locale.ROOT).let { language ->
            when (language) {
                "en", "ja", "zh" -> language
                else -> "zh"
            }
        }
    }
}
