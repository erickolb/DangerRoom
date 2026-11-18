package net.chateaulore.dangerroom

import org.junit.Assert.*
import org.junit.Test

class PerceptualHashTest {
    @Test fun matchesPythonImageHashAcrossImageSizes() {
        // Golden vectors generated with Python ImageHash in the CPHTest experiment.
        val text=javaClass.getResource("/phash-vectors.json")!!.readText()
        val entries=Regex("\\{[^}]+\\}").findAll(text)
        var count=0
        for(entry in entries) {
            val row=entry.value
            fun number(key:String)=Regex("\"$key\"\\s*:\\s*(\\d+)").find(row)!!.groupValues[1].toLong()
            val width=number("width").toInt();val height=number("height").toInt();var state=number("seed")
            val white=Regex("\"white\"\\s*:\\s*true").containsMatchIn(row)
            val expected=Regex("\"hash\"\\s*:\\s*\"([^\"]+)\"").find(row)!!.groupValues[1]
            val pixels=IntArray(width*height) {
                var pixel=255 shl 24
                for(shift in intArrayOf(16,8,0)) { state=(1664525L*state+1013904223L) and 0xffffffffL;pixel=pixel or ((state ushr 24).toInt() shl shift) }
                if(white)-1 else pixel
            }
            assertEquals("vector $count",expected,PerceptualHash.fromArgb(pixels,width,height));count++
        }
        assertTrue(count>5)
    }
}
