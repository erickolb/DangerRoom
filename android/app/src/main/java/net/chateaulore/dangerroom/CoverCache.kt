package net.chateaulore.dangerroom

import java.io.File
import java.security.MessageDigest

/** App-private, per-instance/device cache. A failed cache write never interrupts playback. */
class CoverCache(private val directory: File, private val now: () -> Long = System::currentTimeMillis) {
    private var playlist = emptySet<String>()
    private var limit = 300L * 1024 * 1024
    private val pattern = Regex("[a-f0-9]{64}\\.(jpg|png|webp|gif)")
    companion object {
        const val MAX_AGE = 180L * 24 * 60 * 60 * 1000
        fun scope(connection: Connection): String = MessageDigest.getInstance("SHA-256")
            .digest("${connection.url}\n${connection.device}\n${connection.token}".toByteArray()).joinToString("") { "%02x".format(it) }
    }
    @Synchronized fun configure(files: Set<String>, maxBytes: Long?) {
        playlist = files.filter { pattern.matches(it) }.toSet()
        limit = maxBytes ?: Long.MAX_VALUE
        runCatching {
            directory.mkdirs()
            directory.listFiles()?.filter { it.name.removeSuffix(".access") !in playlist }?.forEach { it.delete() }
            trim(0)
        }
    }
    @Synchronized fun read(name: String): ByteArray? {
        if (name !in playlist) return null
        return runCatching {
            val file = File(directory, name)
            if (!file.isFile || now() - file.lastModified() >= MAX_AGE) { file.delete(); File(directory, "$name.access").delete(); return null }
            val bytes = file.readBytes()
            // Access time is separate from freshness so frequent use cannot extend six months.
            File(directory, "$name.access").apply { writeText(""); setLastModified(now()) }
            bytes
        }.getOrNull()
    }
    @Synchronized fun put(name: String, bytes: ByteArray) {
        if (name !in playlist || bytes.size > limit) return
        val temp = File(directory, "$name.tmp")
        runCatching {
            directory.mkdirs()
            File(directory, name).delete()
            val used = directory.listFiles()?.sumOf { it.length() } ?: 0L
            if (used > limit - bytes.size) return
            temp.writeBytes(bytes)
            check(temp.renameTo(File(directory, name)))
            File(directory, name).setLastModified(now())
            File(directory, "$name.access").apply { writeText(""); setLastModified(now()) }
        }.onFailure { temp.delete() }
    }
    @Synchronized fun clear(): Boolean = runCatching {
        directory.listFiles()?.forEach { it.delete() }
        directory.listFiles()?.isEmpty() ?: true
    }.getOrDefault(false)
    private fun trim(incoming: Long): Boolean {
        val files = directory.listFiles()?.filter { pattern.matches(it.name) } ?: return true
        var size = files.sumOf { it.length() }
        for (file in files.sortedBy { File(directory, "${it.name}.access").takeIf { it.exists() }?.lastModified() ?: it.lastModified() }) {
            if (size <= limit - incoming) break
            val length = file.length()
            if (file.delete()) { size -= length; File(directory, "${file.name}.access").delete() }
        }
        return size <= limit - incoming
    }
}
