package net.chateaulore.dangerroom

import android.graphics.Bitmap
import kotlin.math.*

/** ImageHash phash: Pillow L conversion, Lanczos 32x32, DCT-II, median of 8x8. */
object CoverHash {
    fun fromBitmap(bitmap: Bitmap): String {
        val pixels = IntArray(bitmap.width * bitmap.height)
        bitmap.getPixels(pixels, 0, bitmap.width, 0, 0, bitmap.width, bitmap.height)
        return fromPixels(pixels, bitmap.width, bitmap.height)
    }
    fun fromPixels(pixels: IntArray, width: Int, height: Int): String {
        require(width > 0 && height > 0 && pixels.size == width * height)
        val gray = IntArray(pixels.size) { i ->
            val p = pixels[i]
            (19595 * ((p ushr 16) and 255) + 38470 * ((p ushr 8) and 255) + 7471 * (p and 255) + 32768) ushr 16
        }
        // Pillow resamples grayscale in two passes, rounding/clipping after each pass.
        val horizontal = IntArray(32 * height)
        val wx = weights(width)
        for (y in 0 until height) for (x in 0 until 32) horizontal[y * 32 + x] = sample(wx[x]) { gray[y * width + it] }
        val resized = IntArray(1024)
        val wy = weights(height)
        for (y in 0 until 32) for (x in 0 until 32) resized[y * 32 + x] = sample(wy[y]) { horizontal[it * 32 + x] }
        val cosine = Array(8) { k -> DoubleArray(32) { n -> cos(PI * k * (2 * n + 1) / 64) } }
        val coefficients = DoubleArray(64)
        for (v in 0 until 8) for (u in 0 until 8) {
            var sum = 0.0
            for (y in 0 until 32) for (x in 0 until 32) sum += resized[y * 32 + x] * cosine[v][y] * cosine[u][x]
            coefficients[v * 8 + u] = sum
        }
        val sorted = coefficients.sorted(); val median = (sorted[31] + sorted[32]) / 2
        return (0 until 16).joinToString("") { nibble ->
            var value = 0
            repeat(4) { bit -> value = (value shl 1) or if (coefficients[nibble * 4 + bit] > median) 1 else 0 }
            value.toString(16)
        }
    }
    private fun lanczos(x: Double): Double = when {
        x == 0.0 -> 1.0
        abs(x) >= 3 -> 0.0
        else -> sin(PI * x) / (PI * x) * sin(PI * x / 3) / (PI * x / 3)
    }
    private fun weights(size: Int): Array<List<Pair<Int, Int>>> = Array(32) { target ->
        if (size == 32) listOf(target to (1 shl 22)) else {
            val scale = size / 32.0; val filterScale = max(1.0, scale); val center = (target + 0.5) * scale
            val start = max(0, (center - 3 * filterScale + 0.5).toInt())
            val end = min(size, (center + 3 * filterScale + 0.5).toInt())
            val raw = (start until end).map { it to lanczos((it - center + 0.5) / filterScale) }
            val total = raw.sumOf { it.second }
            raw.map { (index, weight) -> index to (weight / total * (1 shl 22)).roundToInt() }
        }
    }
    private fun sample(weights: List<Pair<Int, Int>>, pixel: (Int) -> Int): Int =
        ((weights.sumOf { (index, weight) -> pixel(index).toLong() * weight } + (1 shl 21)) shr 22).toInt().coerceIn(0, 255)
}
