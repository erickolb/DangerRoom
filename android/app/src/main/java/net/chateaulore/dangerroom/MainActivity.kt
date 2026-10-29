package net.chateaulore.dangerroom

import android.app.AlertDialog
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.ImageDecoder
import android.graphics.Typeface
import android.net.Uri
import android.os.Bundle
import android.provider.MediaStore
import android.view.View
import android.view.WindowManager
import android.webkit.*
import android.widget.*
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.core.content.FileProvider
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URI
import java.util.concurrent.Executors

class MainActivity : ComponentActivity() {
    private lateinit var store: ConnectionStore
    private var connection: Connection? = null
    private var web: WebView? = null
    private lateinit var column: LinearLayout
    private lateinit var status: TextView
    private val worker = Executors.newSingleThreadExecutor()
    private val matcher = Executors.newSingleThreadExecutor()
    private val capture get() = File(filesDir, "captures/comic.jpg")
    private var photoSignature: IntArray? = null
    private var screen = "splash"

    override fun onCreate(savedInstanceState: Bundle?) {
        setTheme(R.style.AppTheme)
        super.onCreate(savedInstanceState)
        store = ConnectionStore(this); connection = store.load()
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                val current = web
                if (screen == "web" && current != null) current.evaluateJavascript("location.hash === '#/home'", { home -> if (home == "true") finish() else current.evaluateJavascript("location.hash='#/home'", null) })
                else if (connection != null) { if (screen in listOf("review", "recognition")) { capture.delete(); photoSignature = null }; openWeb() } else finish()
            }
        })
        val splash = FrameLayout(this).apply { setBackgroundColor(Color.rgb(231, 0, 31)) }
        val mask = ImageView(this).apply { setImageResource(R.drawable.splash_badge); contentDescription = "DangerRoom mask"; scaleType = ImageView.ScaleType.FIT_CENTER }
        splash.addView(mask, FrameLayout.LayoutParams(dp(224), dp(224), android.view.Gravity.CENTER))
        setContentView(splash)
        val bars = androidx.core.view.WindowInsetsControllerCompat(window, splash)
        bars.hide(androidx.core.view.WindowInsetsCompat.Type.systemBars())
        splash.postDelayed({
            if (!isDestroyed) {
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
        text("DangerRoom Android · β-007\nMask: Magnific / Flaticon. Cover artwork belongs to its rights holders. Full credits are in DangerRoom.", 13f)
    }
    @Suppress("SetJavaScriptEnabled")
    private fun openWeb(hash: String = "/home") {
        val c = connection ?: return settings()
        screen = "web"; destroyWeb()
        val view = WebView(this); web = view
        view.setBackgroundColor(Color.rgb(25, 12, 18)); view.settings.javaScriptEnabled = true; view.settings.domStorageEnabled = true
        view.settings.allowFileAccess = false; view.settings.allowContentAccess = false; view.settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW; view.settings.cacheMode = WebSettings.LOAD_NO_CACHE
        CookieManager.getInstance().setAcceptThirdPartyCookies(view, false)
        view.addJavascriptInterface(Bridge(c, view), "DangerRoomAndroid")
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
                    val response = Api(c).request(address.encodedPath + (address.encodedQuery?.let { "?$it" } ?: ""))
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
    private inner class Bridge(private val c: Connection, private val owner: WebView) {
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
        @JavascriptInterface fun camera() { runOnUiThread { if (web === owner) this@MainActivity.camera() } }
        @JavascriptInterface fun keepAwake(enabled: Boolean) { runOnUiThread { if (web === owner) { if (enabled) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) } } }
        @JavascriptInterface fun fullscreen(enabled: Boolean) { runOnUiThread { if (web === owner) { val controller=androidx.core.view.WindowInsetsControllerCompat(window, owner);if(enabled){controller.hide(androidx.core.view.WindowInsetsCompat.Type.systemBars());controller.systemBarsBehavior=androidx.core.view.WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE}else controller.show(androidx.core.view.WindowInsetsCompat.Type.systemBars()) } } }
        @JavascriptInterface fun rank(candidates: String, id: String) {
            if (!id.matches(Regex("[a-f0-9-]{36}"))) return
            val signature = photoSignature
            matcher.execute {
                val scores = JSONObject()
                runCatching {
                    require(signature != null)
                    val urls = JSONArray(candidates)
                    for (i in 0 until minOf(urls.length(), 24)) {
                        val source = urls.optString(i)
                        runCatching {
                            val uri = URI(source)
                            require(uri.scheme == "https" && uri.host in listOf("metron.cloud", "static.metron.cloud") && uri.userInfo == null && uri.port == -1 && uri.path.startsWith("/media/"))
                            val conn = uri.toURL().openConnection() as HttpURLConnection
                            try {
                                conn.connectTimeout = 5000; conn.readTimeout = 5000; conn.instanceFollowRedirects = false
                                require(conn.responseCode == 200)
                                val bytes = conn.inputStream.use { stream -> val out=java.io.ByteArrayOutputStream();val buffer=ByteArray(8192);while(true){val count=stream.read(buffer);if(count<0)break;require(out.size()+count<=25*1024*1024);out.write(buffer,0,count)};out.toByteArray() }
                                val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }; BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
                                require(bounds.outWidth > 0 && bounds.outHeight > 0)
                                val options = BitmapFactory.Options().apply { inSampleSize = maxOf(1, maxOf(bounds.outWidth, bounds.outHeight) / 256) }
                                val bitmap = requireNotNull(BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options))
                                scores.put(source, CoverMatch.distance(signature, CoverMatch.signature(bitmap))); bitmap.recycle()
                            } finally { conn.disconnect() }
                        }
                    }
                }
                runOnUiThread { if (web === owner) owner.evaluateJavascript("window.dangerroomResponses?.[${JSONObject.quote(id)}]?.($scores)", null) }
            }
        }
    }
    private fun camera() {
        capture.parentFile?.mkdirs(); screen = "camera"
        val uri = FileProvider.getUriForFile(this, "$packageName.photos", capture)
        try {
            startActivityForResult(Intent(MediaStore.ACTION_IMAGE_CAPTURE).putExtra(MediaStore.EXTRA_OUTPUT, uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION).apply { clipData = android.content.ClipData.newRawUri("Comic photo", uri) }, 10)
        } catch (_: android.content.ActivityNotFoundException) { Toast.makeText(this, "Enable a camera app to take a photo.", Toast.LENGTH_LONG).show(); screen = "web" }
    }
    @Deprecated("Platform camera result")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != 10) return
        if (resultCode != RESULT_OK || !capture.exists() || capture.length() == 0L) { capture.delete(); openWeb("/camera"); return }
        screen = "recognition"; base("Reading the cover…")
        text("Recognizing text and barcode on this device. The photo stays on your phone.")
        worker.execute {
            try {
                val bitmap = ImageDecoder.decodeBitmap(ImageDecoder.createSource(capture)) { decoder, info, _ ->
                    decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
                    val scale = minOf(1.0, 2000.0 / maxOf(info.size.width, info.size.height)); decoder.setTargetSize(maxOf(1, (info.size.width * scale).toInt()), maxOf(1, (info.size.height * scale).toInt()))
                }
                photoSignature = CoverMatch.signature(bitmap)
                val input = InputImage.fromBitmap(bitmap, 0)
                val scanner = BarcodeScanning.getClient(); val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
                val barcodeTask = scanner.process(input); val textTask = recognizer.process(input)
                com.google.android.gms.tasks.Tasks.whenAllComplete(barcodeTask, textTask).addOnCompleteListener {
                    scanner.close(); recognizer.close()
                    val upc = if (barcodeTask.isSuccessful) barcodeTask.result.firstOrNull { it.rawValue?.matches(Regex("[0-9]{8,18}")) == true }?.rawValue ?: "" else ""
                    val blocks = if (textTask.isSuccessful) textTask.result.textBlocks else emptyList()
                    val lines = blocks.flatMap { it.lines }.filter { it.text.any(Char::isLetter) && it.text.length in 3..100 }
                    val title = lines.maxByOrNull { (it.boundingBox?.height() ?: 0) * (if ((it.boundingBox?.top ?: bitmap.height) < bitmap.height / 2) 2 else 1) }?.text ?: ""
                    val number = Regex("(?:#|ISSUE\\s+|NO\\.?\\s+)([0-9]{1,4}(?:\\.[0-9]+)?)", RegexOption.IGNORE_CASE).find(if(textTask.isSuccessful) textTask.result.text else "")?.groupValues?.get(1) ?: ""
                    if (!isDestroyed) review(bitmap, title, number, upc) else bitmap.recycle()
                }
            } catch (_: Exception) { runOnUiThread { if (!isDestroyed) { openWeb("/camera"); Toast.makeText(this, "Photo could not be read. Retake it or enter a title.", Toast.LENGTH_LONG).show() } } }
        }
    }
    private fun review(bitmap: Bitmap, title: String, issueNumber: String, barcode: String) {
        if (screen != "recognition") { bitmap.recycle(); return }
        screen = "review"; base("Review cover lookup")
        val preview = ImageView(this).apply { setImageBitmap(bitmap); adjustViewBounds = true; contentDescription = "Photographed comic cover" }
        column.addView(preview, LinearLayout.LayoutParams(-1, dp(280)))
        val series = field("Series name", title); val number = field("Issue number", issueNumber); val upc = field("UPC", barcode)
        text("Correct any text before searching. A barcode may omit the comic's five-digit supplement; compare the variant artwork in the results.")
        button("Find matching covers") {
            val query = Uri.Builder().appendQueryParameter("q", series.text.toString().trim()).appendQueryParameter("number", number.text.toString().trim()).appendQueryParameter("upc", upc.text.toString().trim()).appendQueryParameter("captured", "1").build().encodedQuery
            openWeb("/camera?$query"); bitmap.recycle(); capture.delete()
        }
        button("Retake photo") { camera() }
        button("Cancel") { capture.delete(); bitmap.recycle(); openWeb() }
    }
    override fun onPause() { super.onPause(); web?.evaluateJavascript("document.dispatchEvent(new Event('dangerroompause'))", null); window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON); web?.onPause() }
    override fun onResume() { super.onResume(); web?.onResume() }
    override fun onDestroy() { destroyWeb(); worker.shutdownNow(); matcher.shutdownNow(); super.onDestroy() }
}
