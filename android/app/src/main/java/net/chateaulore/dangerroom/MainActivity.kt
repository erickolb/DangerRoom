package net.chateaulore.dangerroom

import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.webkit.*
import android.widget.*
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import org.json.JSONObject
import java.net.URI
import java.util.concurrent.Executors

class MainActivity : ComponentActivity() {
    private lateinit var store: ConnectionStore
    private var connection: Connection? = null
    private var web: WebView? = null
    private lateinit var column: LinearLayout
    private lateinit var status: TextView
    private val worker = Executors.newSingleThreadExecutor()
    private var screen = "splash"

    override fun onCreate(savedInstanceState: Bundle?) {
        setTheme(R.style.AppTheme)
        super.onCreate(savedInstanceState)
        store = ConnectionStore(this); connection = store.load()
        getSharedPreferences("scan-settings", MODE_PRIVATE).edit().clear().apply()
        java.io.File(filesDir, "captures/comic.jpg").delete()
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                val current = web
                if (screen == "web" && current != null) current.evaluateJavascript("location.hash === '#/home'", { home -> if (home == "true") finish() else current.evaluateJavascript("location.hash='#/home'", null) })
                else if (connection != null) openWeb() else finish()
            }
        })
        val splash = FrameLayout(this).apply { setBackgroundColor(Color.rgb(231, 0, 31)) }
        val mask = ImageView(this).apply { setImageResource(R.drawable.splash_badge); contentDescription = "DangerRoom mask"; scaleType = ImageView.ScaleType.FIT_CENTER }
        splash.addView(mask, FrameLayout.LayoutParams(dp(224), dp(224), android.view.Gravity.CENTER))
        setContentView(splash)
        val bars = androidx.core.view.WindowInsetsControllerCompat(window, splash)
        bars.hide(androidx.core.view.WindowInsetsCompat.Type.systemBars())
        splash.postDelayed({
            if (!isDestroyed && screen == "splash") {
                window.setBackgroundDrawable(android.graphics.drawable.ColorDrawable(Color.rgb(25, 12, 18)))
                window.statusBarColor = Color.rgb(25, 12, 18)
                window.navigationBarColor = Color.rgb(25, 12, 18)
                bars.show(androidx.core.view.WindowInsetsCompat.Type.systemBars())
                if (connection == null) settings() else openWeb()
            }
        }, 700)
    }
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
    private fun destroyWeb() { web?.let { it.removeJavascriptInterface("DangerRoomAndroid"); it.stopLoading(); it.destroy() }; web = null; window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) }
    private fun base(title: String) {
        destroyWeb()
        column = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(24), dp(30), dp(24), dp(30)); setBackgroundColor(Color.rgb(25, 12, 18)) }
        val scroll = ScrollView(this).apply { addView(column); fitsSystemWindows = true }
        scroll.setOnApplyWindowInsetsListener { view, insets -> view.setPadding(insets.systemWindowInsetLeft, insets.systemWindowInsetTop, insets.systemWindowInsetRight, insets.systemWindowInsetBottom); insets }
        setContentView(scroll)
        text(title, 30f).typeface = Typeface.create("serif", Typeface.BOLD)
        status = text("", 16f).apply { accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE }
    }
    private fun text(value: String, size: Float = 16f) = TextView(this).apply { text = value; textSize = size; setTextColor(Color.rgb(255, 242, 245)); setPadding(0, dp(10), 0, dp(10)); column.addView(this) }
    private fun button(label: String, action: () -> Unit) = Button(this).apply { text = label; isAllCaps = false; minHeight = dp(48); column.addView(this); setOnClickListener { action() } }
    private fun field(label: String, value: String, secret: Boolean = false): EditText {
        text(label, 15f)
        return EditText(this).apply { setText(value); contentDescription = label; isSingleLine = true; isSaveEnabled = false; setTextColor(Color.WHITE); setHintTextColor(Color.LTGRAY); inputType = if (secret) 129 else 1; column.addView(this) }
    }
    private fun settings() {
        screen = "settings"; base("Connect to DangerRoom")
        val saved = connection
        val hostname = field("DangerRoom hostname", saved?.url ?: "")
        val device = field("Device ID", saved?.device ?: "")
        val secret = field("Device secret", "", true)
        text("Ask your server administrator to issue a device ID and secret. Use your own DangerRoom hostname. HTTPS is required.")
        if (saved != null) text("Leave the secret blank to retain it for the same instance and device.")
        lateinit var saveButton: Button
        saveButton = button("Save and test connection") {
            try {
                val origin = Input.origin(hostname.text.toString()); val id = device.text.toString().trim()
                val token = secret.text.toString().ifBlank { if (saved?.url == origin && saved.device == id) saved.token else "" }
                require(id.matches(Regex("[a-fA-F0-9-]{36}")) && token.matches(Regex("[a-fA-F0-9]{64}"))) { "Enter the device ID and 64-character secret issued by your administrator." }
                val next = Connection(origin, id, token)
                status.text = "Testing device authorization…"
                saveButton.isEnabled = false
                worker.execute {
                    try { Api(next).verify(); store.save(next); connection = next; runOnUiThread { if (!isDestroyed) openWeb() } }
                    catch (error: Exception) { runOnUiThread { if (!isDestroyed) { status.text = error.message; saveButton.isEnabled = true } } }
                }
            } catch (error: Exception) { status.text = error.message }
        }
        if (saved != null) button("Back to menu") { openWeb() }
        text("Danger Room (Hardlight) Android · ${packageManager.getPackageInfo(packageName, 0).versionName}\nMask: Magnific / Flaticon. Cover artwork belongs to its rights holders. Full credits are in DangerRoom.", 13f)
    }
    @Suppress("SetJavaScriptEnabled")
    private fun openWeb(hash: String = "/home") {
        val c = connection ?: return settings()
        screen = "web"; destroyWeb()
        val coverCache = CoverCache(java.io.File(cacheDir, "slideshow/${CoverCache.scope(c)}"))
        val view = WebView(this); web = view
        view.setBackgroundColor(Color.rgb(25, 12, 18)); view.settings.javaScriptEnabled = true; view.settings.domStorageEnabled = true
        view.settings.allowFileAccess = false; view.settings.allowContentAccess = false; view.settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW; view.settings.cacheMode = WebSettings.LOAD_NO_CACHE
        CookieManager.getInstance().setAcceptThirdPartyCookies(view, false)
        view.addJavascriptInterface(Bridge(c, view, coverCache), "DangerRoomAndroid")
        view.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(v: WebView, request: WebResourceRequest): Boolean {
                val address = request.url
                if (sameOrigin(address.toString(), c.url)) return false
                if (address.scheme == "https") runCatching { startActivity(Intent(Intent.ACTION_VIEW, address)) }
                return true
            }
            override fun shouldInterceptRequest(v: WebView, request: WebResourceRequest): WebResourceResponse? {
                val address = request.url
                if (!sameOrigin(address.toString(), c.url)) return null
                return try {
                    val path = address.encodedPath.orEmpty()
                    val filename = path.removePrefix("/covers/")
                    val cached = if (request.method == "GET" && path.startsWith("/covers/")) coverCache.read(filename) else null
                    val response = if (cached != null) Response(200, cached, when (filename.substringAfterLast('.')) { "jpg" -> "image/jpeg"; "png" -> "image/png"; "gif" -> "image/gif"; else -> "image/webp" })
                        else Api(c).request(address.encodedPath + (address.encodedQuery?.let { "?$it" } ?: ""))
                    if (cached == null && response.status == 200 && response.type.startsWith("image/") && path.startsWith("/covers/")) coverCache.put(filename, response.bytes)
                    val headers = mapOf("Cache-Control" to "no-store", "Content-Security-Policy" to "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https://static.metron.cloud https://metron.cloud; connect-src 'self'; base-uri 'none'; frame-src 'none'; object-src 'none'; form-action 'self'")
                    WebResourceResponse(response.type.substringBefore(';'), "utf-8", response.status, if (response.status in 200..299) "OK" else "Request failed", headers, response.bytes.inputStream())
                } catch (_: Exception) { WebResourceResponse("text/plain", "utf-8", 503, "Unavailable", mapOf("Cache-Control" to "no-store"), "Could not reach DangerRoom. Check your connection; use Back to return to the menu.".byteInputStream()) }
            }
            override fun onReceivedHttpError(v: WebView, request: WebResourceRequest, response: WebResourceResponse) {
                if (request.isForMainFrame) runOnUiThread { if (!isDestroyed && web === view) { settings(); status.text = "Server returned HTTP ${response.statusCode}. Check the instance and device credentials." } }
            }
        }
        view.setOnApplyWindowInsetsListener { v, insets -> v.setPadding(insets.systemWindowInsetLeft, insets.systemWindowInsetTop, insets.systemWindowInsetRight, insets.systemWindowInsetBottom); insets }
        setContentView(view); view.loadUrl("${c.url}/mobile/#$hash")
    }
    private fun sameOrigin(address: String, origin: String): Boolean = runCatching { val a = URI(address); val b = URI(origin); a.scheme == b.scheme && a.host == b.host && a.port == b.port && a.userInfo == null }.getOrDefault(false)
    private inner class Bridge(private val c: Connection, private val owner: WebView, private val coverCache: CoverCache) {
        @JavascriptInterface fun flushCoverCache(): Boolean = coverCache.clear()
        @JavascriptInterface fun configureCoverCache(files: String, limited: Boolean, megabytes: Int) {
            val array = org.json.JSONArray(files)
            coverCache.configure((0 until array.length()).map { array.getString(it) }.toSet(), if (limited) megabytes.coerceIn(1, 1048576).toLong() * 1024 * 1024 else null)
        }
        @JavascriptInterface fun request(path: String, method: String, body: String, id: String) {
            if (!id.matches(Regex("[a-f0-9-]{36}"))) return
            worker.execute {
                val result = try {
                    require(Input.apiPath(path)); val response = Api(c).request("/mobile$path", method, body)
                    JSONObject().put("status", response.status).put("data", JSONObject(String(response.bytes)))
                } catch (error: Exception) { JSONObject().put("status", 503).put("data", JSONObject().put("error", error.message ?: "Unable to reach DangerRoom.")) }
                runOnUiThread { if (web === owner) owner.evaluateJavascript("window.dangerroomResponses?.[${JSONObject.quote(id)}]?.($result)", null) }
            }
        }
        @JavascriptInterface fun settings() { runOnUiThread { if (web === owner) this@MainActivity.settings() } }
        @JavascriptInterface fun keepAwake(enabled: Boolean) { runOnUiThread { if (web === owner) { if (enabled) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) } } }
        @JavascriptInterface fun fullscreen(enabled: Boolean) { runOnUiThread { if (web === owner) { val controller=androidx.core.view.WindowInsetsControllerCompat(window, owner);if(enabled){controller.hide(androidx.core.view.WindowInsetsCompat.Type.systemBars());controller.systemBarsBehavior=androidx.core.view.WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE}else controller.show(androidx.core.view.WindowInsetsCompat.Type.systemBars()) } } }
    }
    override fun onPause() { super.onPause(); web?.evaluateJavascript("document.dispatchEvent(new Event('dangerroompause'))", null); window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON); web?.onPause() }
    override fun onResume() { super.onResume(); web?.onResume() }
    override fun onDestroy() { destroyWeb(); worker.shutdownNow(); super.onDestroy() }
}
