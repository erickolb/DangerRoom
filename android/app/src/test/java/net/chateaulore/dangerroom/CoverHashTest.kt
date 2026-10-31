package net.chateaulore.dangerroom
import org.junit.Assert.assertEquals
import org.junit.Test
class CoverHashTest {
    @Test fun matchesPythonImageHashReference() {
        run {
            val w=32; val h=32
            val pixels=IntArray(w*h) { i -> val x=i%w;val y=i/w
                (255 shl 24) or (((x*17+y*7+x*y)%256) shl 16) or (((x*3+y*29)%256) shl 8) or ((x*11+y*13+x*y*3)%256)
            }
            assertEquals("96010747377e2c7d",CoverHash.fromPixels(pixels,w,h))
        }
        run {
            val w=173; val h=251
            val pixels=IntArray(w*h) { i -> val x=i%w;val y=i/w
                (255 shl 24) or (((x*17+y*7+x*y)%256) shl 16) or (((x*3+y*29)%256) shl 8) or ((x*11+y*13+x*y*3)%256)
            }
            assertEquals("edf287505552a792",CoverHash.fromPixels(pixels,w,h))
        }
        run {
            val w=17; val h=23
            val pixels=IntArray(w*h) { i -> val x=i%w;val y=i/w
                (255 shl 24) or (((x*17+y*7+x*y)%256) shl 16) or (((x*3+y*29)%256) shl 8) or ((x*11+y*13+x*y*3)%256)
            }
            assertEquals("810f18133566f7bd",CoverHash.fromPixels(pixels,w,h))
        }
        run {
            val w=420; val h=630
            val pixels=IntArray(w*h) { i -> val x=i%w;val y=i/w
                (255 shl 24) or (((x*17+y*7+x*y)%256) shl 16) or (((x*3+y*29)%256) shl 8) or ((x*11+y*13+x*y*3)%256)
            }
            assertEquals("daed0ee94e9028d9",CoverHash.fromPixels(pixels,w,h))
        }
    }
}
