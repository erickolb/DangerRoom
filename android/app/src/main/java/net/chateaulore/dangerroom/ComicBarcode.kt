package net.chateaulore.dangerroom

import com.google.zxing.BarcodeFormat
import com.google.zxing.BinaryBitmap
import com.google.zxing.DecodeHintType
import com.google.zxing.MultiFormatReader
import com.google.zxing.RGBLuminanceSource
import com.google.zxing.ResultMetadataType
import com.google.zxing.common.HybridBinarizer

/** Read the printed five-digit add-on from bars, never infer an issue/variant code. */
object ComicBarcode {
    fun combine(main: String, supplement: String?): String? {
        val base = if (main.length == 13 && main.startsWith("0")) main.drop(1) else main
        if (!base.matches(Regex("[0-9]{12,13}")) || supplement?.matches(Regex("[0-9]{5}")) != true) return null
        return base + supplement
    }

    fun read(pixels: IntArray, width: Int, height: Int): String? {
        val hints = mapOf(
            DecodeHintType.POSSIBLE_FORMATS to listOf(BarcodeFormat.UPC_A, BarcodeFormat.EAN_13),
            DecodeHintType.ALLOWED_EAN_EXTENSIONS to intArrayOf(5),
            DecodeHintType.TRY_HARDER to true,
        )
        fun decode(data: IntArray, w: Int, h: Int): String? = try {
            val result = MultiFormatReader().decode(BinaryBitmap(HybridBinarizer(RGBLuminanceSource(w, h, data))), hints)
            combine(result.text, result.resultMetadata?.get(ResultMetadataType.UPC_EAN_EXTENSION) as? String)
        } catch (_: com.google.zxing.ReaderException) { null }
        decode(pixels, width, height)?.let { return it }
        // One-dimensional decoding handles reversed rows; rotate once for vertical barcodes.
        val rotated = IntArray(pixels.size)
        for (y in 0 until height) for (x in 0 until width) rotated[x * height + height - 1 - y] = pixels[y * width + x]
        return decode(rotated, height, width)
    }
}
