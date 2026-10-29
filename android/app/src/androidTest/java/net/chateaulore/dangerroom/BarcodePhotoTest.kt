package net.chateaulore.dangerroom

import android.graphics.BitmapFactory
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.Assert.*

/** Use an emulator or dedicated test device: connected-test cleanup can uninstall the target app. */
@RunWith(AndroidJUnit4::class)
class BarcodePhotoTest {
    @Test fun recoversTheSupplementFromTheFailingTabletPhoto() {
        val context=InstrumentationRegistry.getInstrumentation().context
        val bitmap=context.assets.open("tablet-barcode.png").use { BitmapFactory.decodeStream(it) }
        val recognizer=TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
        val scanner=com.google.mlkit.vision.barcode.BarcodeScanning.getClient()
        try {
            val pixels=IntArray(bitmap.width*bitmap.height)
            bitmap.getPixels(pixels,0,bitmap.width,0,0,bitmap.width,bitmap.height)
            assertNull("This regression photo cannot be read by the bars-only path",ComicBarcode.read(pixels,bitmap.width,bitmap.height))
            val input=InputImage.fromBitmap(bitmap,0)
            val main=Tasks.await(scanner.process(input)).first { it.rawValue=="759606215584" }
            val text=Tasks.await(recognizer.process(input))
            val lines=text.textBlocks.flatMap { it.lines }.mapNotNull { line -> line.boundingBox?.let { b -> ComicBarcode.PrintedText(line.text,b.left,b.top,b.right,b.bottom) } }
            val box=requireNotNull(main.boundingBox)
            val actual=ComicBarcode.withPrintedSupplement(main.rawValue!!,intArrayOf(box.left,box.top,box.right,box.bottom),lines)
            assertEquals("75960621558400111",actual)
        }finally{recognizer.close();scanner.close();bitmap.recycle()}
    }
}
