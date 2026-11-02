package net.chateaulore.dangerroom

import org.junit.Assert.*
import org.junit.Test
import java.nio.file.Files

class CoverCacheTest {
    private val a = "a".repeat(64) + ".jpg"
    private val b = "b".repeat(64) + ".png"
    private val c = "c".repeat(64) + ".webp"
    @Test fun fullCachePreservesExistingFilesAndDoesNotStoreNewImages() {
        val dir = Files.createTempDirectory("covers").toFile()
        try {
            var time = 100000L
            val cache = CoverCache(dir) { time }
            cache.configure(setOf(a, b, c), 6)
            cache.put(a, byteArrayOf(1, 2, 3)); time += 1000
            cache.put(b, byteArrayOf(4, 5, 6)); time += 1000
            assertNotNull(cache.read(a)); time += 1000
            cache.put(c, byteArrayOf(7, 8, 9))
            assertNotNull(cache.read(b)); assertNotNull(cache.read(a)); assertNull(cache.read(c))
            cache.put(c, ByteArray(7)); assertNull(cache.read(c))
            assertTrue(dir.listFiles()!!.sumOf { it.length() } <= 6)
        } finally { dir.deleteRecursively() }
    }
    @Test fun freshnessDoesNotExtendOnReadAndPlaylistCleanupIncludesEmptyPlaylist() {
        val dir = Files.createTempDirectory("covers").toFile()
        try {
            var time = 100000L
            val cache = CoverCache(dir) { time }
            cache.configure(setOf(a, b), null)
            cache.put(a, ByteArray(10)); cache.put(b, ByteArray(10))
            time += CoverCache.MAX_AGE - 1000
            assertNotNull(cache.read(a))
            time += 1000
            assertNull(cache.read(a))
            cache.configure(setOf(b), null)
            assertFalse(java.io.File(dir, a).exists())
            cache.configure(emptySet(), null)
            assertEquals(0, dir.listFiles()!!.size)
        } finally { dir.deleteRecursively() }
    }
    @Test fun unlimitedCanBeReducedAndFlushedAndSurvivesReopening() {
        val dir = Files.createTempDirectory("covers").toFile()
        try {
            val cache = CoverCache(dir)
            cache.configure(setOf(a, b), null)
            cache.put(a, ByteArray(8)); cache.put(b, ByteArray(8))
            val reopened = CoverCache(dir)
            reopened.configure(setOf(a, b), null)
            assertNotNull(reopened.read(a)); assertNotNull(reopened.read(b))
            reopened.configure(setOf(a, b), 8)
            assertEquals(8L, dir.listFiles()!!.sumOf { it.length() })
            reopened.clear()
            assertNull(reopened.read(a)); assertNull(reopened.read(b))
            reopened.put(a, ByteArray(8)); assertNotNull(reopened.read(a))
        } finally { dir.deleteRecursively() }
    }
}
