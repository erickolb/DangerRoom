package net.chateaulore.dangerroom

import android.graphics.Bitmap
import android.graphics.Color

object CoverMatch {
    // An advisory comparison only: framing, glare and perspective can change this distance.
    fun signature(bitmap: Bitmap): IntArray {
        val scaled = Bitmap.createScaledBitmap(bitmap, 8, 8, true)
        val pixels = IntArray(64); scaled.getPixels(pixels, 0, 8, 0, 0, 8, 8)
        val values = IntArray(192)
        pixels.forEachIndexed { i, p -> values[i * 3] = Color.red(p); values[i * 3 + 1] = Color.green(p); values[i * 3 + 2] = Color.blue(p) }
        if (scaled !== bitmap) scaled.recycle()
        return values
    }
    fun distance(a: IntArray, b: IntArray): Double {
        require(a.size == 192 && b.size == 192)
        val averageA = a.average(); val averageB = b.average()
        return a.indices.sumOf { kotlin.math.abs((a[it] - averageA) - (b[it] - averageB)) } / a.size
    }
}
