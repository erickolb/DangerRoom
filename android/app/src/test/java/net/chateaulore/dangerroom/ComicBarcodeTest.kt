package net.chateaulore.dangerroom

import com.google.zxing.oned.UPCAWriter
import com.google.zxing.BarcodeFormat
import org.junit.Assert.*
import org.junit.Test

class ComicBarcodeTest {
    @Test fun printedSupplementMustBeUniqueAndBesideTheMainBarcode() {
        val main="759606215584"
        val box=intArrayOf(450,990,565,1250)
        val supplement=ComicBarcode.PrintedText("0 0 1 1 1",450,850,475,970)
        assertEquals(main+"00111",ComicBarcode.withPrintedSupplement(main,box,listOf(supplement)))
        assertNull(ComicBarcode.withPrintedSupplement(main,box,listOf(supplement.copy(text="OO111"))))
        assertNull(ComicBarcode.withPrintedSupplement(main,box,listOf(supplement.copy(top=100,bottom=200))))
        assertNull(ComicBarcode.withPrintedSupplement(main,box,listOf(supplement.copy(left=10,right=30))))
        assertNull(ComicBarcode.withPrintedSupplement(main,box,listOf(supplement.copy(top=1050,bottom=1100))))
        assertNull(ComicBarcode.withPrintedSupplement(main,box,listOf(supplement,supplement.copy(text="00211"))))
        assertNull(ComicBarcode.withPrintedSupplement(main,box,emptyList()))
        assertEquals(main+"00111",ComicBarcode.withPrintedSupplement(main,box,listOf(supplement,supplement)))
        assertEquals(main+"00111",ComicBarcode.withPrintedSupplement(main,intArrayOf(990,450,1250,565),listOf(ComicBarcode.PrintedText("00111",850,450,970,475))))
    }

    @Test fun combinesTheExactSupplementAndPreservesZeros() {
        assertEquals("75960621558400111", ComicBarcode.combine("759606215584", "00111"))
        assertEquals("75960621558400111", ComicBarcode.combine("0759606215584", "00111"))
        assertNull(ComicBarcode.combine("759606215584", null))
        assertNull(ComicBarcode.combine("759606215584", "11"))
        assertNull(ComicBarcode.combine("759606215584", "0011x"))
    }

    @Test fun readsActualBarsIncludingFiveDigitSupplementAndRotation() {
        val main = UPCAWriter().encode("759606215584", BarcodeFormat.UPC_A, 0, 1)
        val digits = "00111"
        val l = listOf("0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011")
        var checksum = 0
        for (i in 3 downTo 0 step 2) checksum += digits[i].digitToInt()
        checksum *= 3
        for (i in 4 downTo 0 step 2) checksum += digits[i].digitToInt()
        checksum = checksum * 3 % 10
        val parity = intArrayOf(0x18, 0x14, 0x12, 0x11, 0x0c, 0x06, 0x03, 0x0a, 0x09, 0x05)[checksum]
        var extension = "1011"
        for ((i, digit) in digits.withIndex()) {
            if (i > 0) extension += "01"
            val pattern = l[digit.digitToInt()]
            extension += if (parity and (1 shl (4-i)) != 0) pattern.reversed().map { if (it=='1') '0' else '1' }.joinToString("") else pattern
        }
        val bits = "0000000000" + (0 until main.width).joinToString("") { if (main[it, 0]) "1" else "0" } + "000000000" + extension + "0000000000"
        val w=bits.length*3; val h=150
        val pixels=IntArray(w*h) { index -> if(index/w in 15..135 && bits[index%w/3]=='1') 0xff000000.toInt() else 0xffffffff.toInt() }
        assertEquals("75960621558400111", ComicBarcode.read(pixels,w,h))
        val rotated=IntArray(pixels.size)
        for(y in 0 until h) for(x in 0 until w) rotated[x*h+h-1-y]=pixels[y*w+x]
        assertEquals("75960621558400111", ComicBarcode.read(rotated,h,w))
        val bare=IntArray(w*h) { index -> if(index/w in 15..135 && index%w/3 < 10+main.width && bits[index%w/3]=='1') 0xff000000.toInt() else 0xffffffff.toInt() }
        assertNull(ComicBarcode.read(bare,w,h))
    }
}
