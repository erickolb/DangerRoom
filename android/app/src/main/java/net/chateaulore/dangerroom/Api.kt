package net.chateaulore.dangerroom

import java.net.HttpURLConnection
import java.net.URI
import org.json.JSONObject

object Input {
    // Raise only when a client starts depending on new server behavior.
    const val minimumServerVersion = "1.1.0"
    fun supportsServer(version: String): Boolean {
        if (!version.matches(Regex("[0-9]+\\.[0-9]+\\.[0-9]+"))) return false
        val actual=version.split('.').map { it.toIntOrNull() ?: return false }
        val required=minimumServerVersion.split('.').map { it.toInt() }
        for(i in 0..2) { if(actual[i]!=required[i]) return actual[i]>required[i] }
        return true
    }
    fun origin(raw: String): String {
        val value = if (raw.trim().contains("://")) raw.trim() else "https://${raw.trim()}"
        val uri = URI(value)
        require(uri.scheme == "https" && !uri.host.isNullOrBlank() && uri.userInfo == null && uri.query == null && uri.fragment == null && (uri.path.isNullOrEmpty() || uri.path == "/")) { "Enter an HTTPS hostname without a path, query, or credentials." }
        return URI("https", null, uri.host.lowercase(), uri.port, null, null, null).toString()
    }
    fun apiPath(path: String): Boolean {
        val uri = runCatching { URI(path) }.getOrNull() ?: return false
        return !uri.isAbsolute && uri.rawAuthority == null && path.startsWith("/api/") && !path.contains("\\") && !path.contains("..") && uri.fragment == null
    }
}
data class Response(val status: Int, val bytes: ByteArray, val type: String)
class Api(private val connection: Connection) {
    fun request(path: String, method: String = "GET", body: String = ""): Response {
        val bytes=body.toByteArray(); require(bytes.size <= 8192)
        return exchange(path,method,bytes,"application/json")
    }
    private fun exchange(path: String, method: String, body: ByteArray, contentType: String): Response {
        require(path.startsWith("/") && !path.startsWith("//") && !path.contains("\\") && !path.contains(".."))
        require(method in listOf("GET", "POST", "PATCH", "DELETE"))
        val url = URI(Input.origin(connection.url) + path).toURL()
        val conn = url.openConnection() as HttpURLConnection
        try {
            conn.connectTimeout = 15000; conn.readTimeout = 90000; conn.instanceFollowRedirects = false; conn.requestMethod = method
            conn.setRequestProperty("X-Device-Id", connection.device)
            conn.setRequestProperty("Authorization", "Bearer ${connection.token}")
            if (body.isNotEmpty()) {
                conn.doOutput = true; conn.setRequestProperty("Content-Type", contentType); conn.setFixedLengthStreamingMode(body.size)
                conn.outputStream.use { it.write(body) }
            }
            val status = conn.responseCode
            val bytes = (if (status in 200..299) conn.inputStream else conn.errorStream)?.use { stream ->
                val out = java.io.ByteArrayOutputStream(); val buffer = ByteArray(8192)
                while (true) { val size = stream.read(buffer); if (size < 0) break; require(out.size() + size <= 26 * 1024 * 1024) { "Server response is too large." }; out.write(buffer, 0, size) }; out.toByteArray()
            } ?: ByteArray(0)
            return Response(status, bytes, conn.contentType ?: "application/octet-stream")
        } finally { conn.disconnect() }
    }
    fun verify() {
        val health=request("/mobile/api/health")
        require(health.status==200) { "Unable to check the DangerRoom version. Check your connection and device credentials." }
        val version=JSONObject(String(health.bytes)).optString("version")
        if(!Input.supportsServer(version)) throw ServerUpdateRequired()
        val response = request("/mobile/api/device")
        require(response.status == 200 && JSONObject(String(response.bytes)).optBoolean("authorized")) { "Device not authorized. Check the hostname, device ID, secret, and server version." }
    }
}

class ServerUpdateRequired : Exception("Please update your DangerRoom server to at least ${Input.minimumServerVersion} for Hardlight ${BuildConfig.VERSION_NAME} to work. Then tap Retry. Your collection and connection settings are preserved.")
