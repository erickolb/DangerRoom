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

    data class PrintedText(val text: String, val left: Int, val top: Int, val right: Int, val bottom: Int)

    /** Only use a unique five-digit OCR line beside either end of the detected main barcode. */
    fun withPrintedSupplement(main: String, box: IntArray, lines: List<PrintedText>): String? {
        if (box.size != 4 || box[0]>=box[2] || box[1]>=box[3]) return null
        val vertical = box[3]-box[1] > box[2]-box[0]
        val start = if(vertical) box[1].toDouble() else box[0].toDouble()
        val end = if(vertical) box[3].toDouble() else box[2].toDouble()
        val crossStart = if(vertical) box[0].toDouble() else box[1].toDouble()
        val crossEnd = if(vertical) box[2].toDouble() else box[3].toDouble()
        val length=end-start
        val candidates=lines.mapNotNull { line ->
            val digits=line.text.filterNot(Char::isWhitespace)
            if(!digits.matches(Regex("[0-9]{5}"))) return@mapNotNull null
            val along=if(vertical) (line.top+line.bottom)/2.0 else (line.left+line.right)/2.0
            val across=if(vertical) (line.left+line.right)/2.0 else (line.top+line.bottom)/2.0
            val beside=(along < start && along >= start-length) || (along > end && along <= end+length)
            val aligned=kotlin.math.abs(across-(crossStart+crossEnd)/2) <= maxOf((crossEnd-crossStart)*1.5,length*.25)
            if(beside && aligned) digits else null
        }.toSet()
        return candidates.singleOrNull()?.let { combine(main,it) }
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
