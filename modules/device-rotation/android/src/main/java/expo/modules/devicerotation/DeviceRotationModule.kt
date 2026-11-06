package expo.modules.devicerotation

import android.hardware.SensorManager
import android.provider.Settings
import android.view.OrientationEventListener
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Reports how the phone is physically held while the screen stays locked to
 * portrait, so the video player can open full screen without the screen first
 * rotating with the navigation bar on its side. Honours the system rotation lock.
 */
class DeviceRotationModule : Module() {
  private var listener: OrientationEventListener? = null
  private var lastRotation: String? = null

  private fun isAutoRotateOn(): Boolean {
    val resolver = appContext.reactContext?.contentResolver ?: return false
    return Settings.System.getInt(resolver, Settings.System.ACCELEROMETER_ROTATION, 0) == 1
  }

  private fun rotationFor(degrees: Int): String? = when (degrees) {
    in 0..10, in 350..359, in 170..190 -> "portrait"
    in 80..100, in 260..280 -> "landscape"
    else -> null
  }

  private fun stopListening() {
    listener?.disable()
    listener = null
    lastRotation = null
  }

  private fun startListening() {
    val context = appContext.reactContext ?: return
    stopListening()
    listener = object : OrientationEventListener(context, SensorManager.SENSOR_DELAY_NORMAL) {
      override fun onOrientationChanged(degrees: Int) {
        val rotation = rotationFor(degrees) ?: return
        if (rotation == lastRotation) return
        if (rotation == "landscape" && !isAutoRotateOn()) return
        lastRotation = rotation
        sendEvent("onRotation", mapOf("rotation" to rotation))
      }
    }.also { it.enable() }
  }

  override fun definition() = ModuleDefinition {
    Name("DeviceRotation")
    Events("onRotation")

    Function("start") { startListening() }

    Function("stop") { stopListening() }

    OnDestroy { stopListening() }
  }
}
