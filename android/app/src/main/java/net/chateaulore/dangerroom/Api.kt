package net.chateaulore.dangerroom

import java.net.HttpURLConnection
import java.net.URI
import android.net.Uri
import org.json.JSONObject

object Input {
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
    fun saveScan(captureId: String, hash: String, mode: String, version: String, png: ByteArray): Long {
        require(png.size <= 25 * 1024 * 1024) { "Scan image exceeds 25 MB. Retake the cover at a lower camera resolution." }
        val query=Uri.Builder().appendQueryParameter("capture_id",captureId).appendQueryParameter("cover_hash",hash)
            .appendQueryParameter("mode",mode).appendQueryParameter("client_version",version).build().encodedQuery
        val response=exchange("/mobile/api/scan-captures?$query","POST",png,"image/png")
        val data=runCatching { JSONObject(String(response.bytes)) }.getOrNull()
        require(response.status == 201) { when(response.status) {
            404,405 -> "Update DangerRoom to β-024 or later to retain scans, then try again."
            413 -> "Scan upload is too large for the server or reverse proxy. Check its 25 MB upload limit."
            else -> data?.optString("error")?.takeIf { it.isNotBlank() }
                ?: "Could not retain this scan (HTTP ${response.status}). Check the server connection."
        } }
        return requireNotNull(data).getLong("id")
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
        val response = request("/mobile/api/device")
        require(response.status == 200 && JSONObject(String(response.bytes)).optBoolean("authorized")) { "Device not authorized. Check the hostname, device ID, secret, and server version." }
    }
}
