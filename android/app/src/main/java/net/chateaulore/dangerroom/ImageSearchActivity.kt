package net.chateaulore.dangerroom

import android.content.Intent
import android.graphics.*
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.content.res.ColorStateList
import android.os.Bundle
import android.view.MotionEvent
import android.view.Gravity
import android.view.View
import android.widget.*
import androidx.activity.ComponentActivity
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import com.google.mlkit.vision.documentscanner.*
import java.io.File
import java.util.concurrent.Executors

/** Uses the same document scanner and ImageHash-compatible pHash as CPHTest. Images stay on device. */
class ImageSearchActivity : ComponentActivity() {
    private lateinit var column: LinearLayout
    private var distance=16
    private var bitmap: Bitmap?=null
    private var busy=false
    private val ink=Color.rgb(255,242,245)
    private val muted=Color.rgb(212,185,193)
    private val accent=Color.rgb(239,101,117)
    private val border=Color.rgb(97,48,62)
    private val worker=Executors.newSingleThreadExecutor()
    private val capture=registerForActivityResult(ActivityResultContracts.StartIntentSenderForResult()) { result ->
        busy=false
        val uri=GmsDocumentScanningResult.fromActivityResultIntent(result.data)?.pages?.firstOrNull()?.imageUri
        if(result.resultCode!=RESULT_OK || uri==null) { if(bitmap==null) home() else review();return@registerForActivityResult }
        screen("Reading captured image…")
        worker.execute {
            val file=File(cacheDir,"cover-search.jpg")
            try {
                contentResolver.openInputStream(uri)!!.use { input -> file.outputStream().use { input.copyTo(it) } }
                val bounds=BitmapFactory.Options().apply { inJustDecodeBounds=true };BitmapFactory.decodeFile(file.path,bounds)
                require(bounds.outWidth>0 && bounds.outHeight>0 && bounds.outWidth.toLong()*bounds.outHeight<=32_000_000) { "Image too large or unreadable. Please recapture it." }
                var sample=1
                while(bounds.outWidth.toLong()*bounds.outHeight/(sample.toLong()*sample)>4_000_000)sample*=2
                val image=BitmapFactory.decodeFile(file.path,BitmapFactory.Options().apply { inSampleSize=sample;inPreferredConfig=Bitmap.Config.ARGB_8888 }) ?: error("Unable to read captured image.")
                runOnUiThread { if(!isDestroyed) { bitmap?.recycle();bitmap=image;review() } else image.recycle() }
            } catch(error:Exception) { runOnUiThread { if(!isDestroyed) { home();message(error.message ?: "Unable to read capture.") } } }
            finally { file.delete() }
        }
    }
    override fun onCreate(savedInstanceState:Bundle?) { super.onCreate(savedInstanceState);distance=savedInstanceState?.getInt("distance",16) ?: 16;home() }
    override fun onSaveInstanceState(outState:Bundle) { outState.putInt("distance",distance);super.onSaveInstanceState(outState) }
    private fun dp(n:Int)=(n*resources.displayMetrics.density).toInt()
    private fun screen(title:String) {
        val root=LinearLayout(this).apply { orientation=LinearLayout.VERTICAL;setPadding(dp(14),dp(22),dp(14),dp(28)) }
        val scroll=ScrollView(this).apply {
            isFillViewport=true;addView(root);fitsSystemWindows=true
            background=GradientDrawable(GradientDrawable.Orientation.TL_BR,intArrayOf(Color.rgb(65,24,39),Color.rgb(25,12,18),Color.rgb(25,12,18)))
        }
        scroll.setOnApplyWindowInsetsListener { view,insets -> view.setPadding(insets.systemWindowInsetLeft,insets.systemWindowInsetTop,insets.systemWindowInsetRight,insets.systemWindowInsetBottom);insets }
        val header=LinearLayout(this).apply { orientation=LinearLayout.HORIZONTAL;gravity=Gravity.CENTER_VERTICAL;setPadding(0,dp(8),0,dp(16)) }
        header.addView(ImageView(this).apply { setImageResource(R.drawable.mask);contentDescription="DangerRoom" },LinearLayout.LayoutParams(dp(48),dp(48)))
        val brand=LinearLayout(this).apply { orientation=LinearLayout.VERTICAL;setPadding(dp(16),0,dp(8),0) }
        brand.addView(TextView(this).apply { text="DangerRoom";textSize=27f;typeface=Typeface.create("serif",Typeface.NORMAL);setTextColor(ink) })
        brand.addView(TextView(this).apply { text="Your Comics Sidekick";textSize=11.5f;setTextColor(Color.rgb(238,161,175));setPadding(0,dp(5),0,0) })
        header.addView(brand,LinearLayout.LayoutParams(0,-2,1f))
        header.addView(styledButton("Menu",false) { finish() },LinearLayout.LayoutParams(-2,dp(44)))
        root.addView(header)
        column=LinearLayout(this).apply {
            orientation=LinearLayout.VERTICAL;setPadding(dp(16),dp(18),dp(16),dp(20))
            background=rounded(Color.rgb(38,17,25),border,12)
        }
        root.addView(column,LinearLayout.LayoutParams(-1,-2).apply { topMargin=dp(14) })
        column.addView(View(this).apply { setBackgroundColor(Color.rgb(228,87,112)) },LinearLayout.LayoutParams(-1,dp(3)).apply { bottomMargin=dp(20) })
        label("FIND A COMIC BY ITS COVER",10f).apply { setTextColor(Color.rgb(238,161,175));letterSpacing=.12f }
        label(title,30f).apply { typeface=Typeface.create("serif",Typeface.NORMAL);setTextColor(ink);setPadding(0,dp(3),0,dp(18));isAccessibilityHeading=true }
        setContentView(scroll)
    }
    private fun rounded(fill:Int,stroke:Int,radius:Int)=GradientDrawable().apply { setColor(fill);cornerRadius=dp(radius).toFloat();setStroke(dp(1),stroke) }
    private fun label(value:String,size:Float=14f)=TextView(this).apply { text=value;textSize=size;setTextColor(muted);setLineSpacing(dp(3).toFloat(),1.15f);setPadding(0,dp(8),0,dp(8));column.addView(this) }
    private fun styledButton(value:String,primary:Boolean,action:()->Unit)=Button(this).apply {
        text=value;isAllCaps=false;textSize=14f;typeface=Typeface.create("sans-serif-medium",Typeface.NORMAL)
        setTextColor(if(primary)Color.rgb(42,13,22) else ink)
        backgroundTintList=null
        background=RippleDrawable(ColorStateList.valueOf(Color.argb(55,255,242,245)),rounded(if(primary)accent else Color.TRANSPARENT,if(primary)accent else Color.rgb(106,53,69),7),null)
        minHeight=dp(48);minimumHeight=dp(48);setPadding(dp(16),dp(10),dp(16),dp(10));stateListAnimator=null
        setOnClickListener { action() }
    }
    private fun button(value:String,primary:Boolean=false,action:()->Unit)=styledButton(value,primary,action).also {
        column.addView(it,LinearLayout.LayoutParams(-1,-2).apply { topMargin=dp(12) })
    }
    private fun message(value:String) {
        val dialog=android.app.AlertDialog.Builder(this).setTitle("Image Cover Search").setMessage(value).setPositiveButton("OK",null).create()
        dialog.setOnShowListener { dialog.window?.setBackgroundDrawable(rounded(Color.rgb(43,20,30),border,12));dialog.getButton(android.app.AlertDialog.BUTTON_POSITIVE).setTextColor(accent) }
        dialog.show()
    }
    private fun home() {
        screen("Image Cover Search")
        label("Find a comic from a photo of its cover. Capture an image, adjust its edges, then search Metron.")
        val settings=LinearLayout(this).apply { orientation=LinearLayout.HORIZONTAL;gravity=Gravity.CENTER_VERTICAL;setPadding(0,dp(18),0,dp(8)) }
        settings.addView(TextView(this).apply { text="Hash distance";textSize=15f;setTextColor(ink) },LinearLayout.LayoutParams(0,-2,1f))
        val value=TextView(this).apply { text="$distance";textSize=15f;setTextColor(ink);gravity=Gravity.CENTER;setPadding(dp(12),dp(5),dp(12),dp(5));background=rounded(Color.rgb(64,32,44),border,20) }
        settings.addView(value);column.addView(settings)
        column.addView(SeekBar(this).apply { min=10;max=20;progress=distance;contentDescription="Hash distance";thumbTintList=ColorStateList.valueOf(accent);progressTintList=ColorStateList.valueOf(accent);progressBackgroundTintList=ColorStateList.valueOf(border);minimumHeight=dp(48);setOnSeekBarChangeListener(object:SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(bar:SeekBar?,progress:Int,fromUser:Boolean) { distance=progress;value.text="$distance" }
            override fun onStartTrackingTouch(bar:SeekBar?) {}
            override fun onStopTrackingTouch(bar:SeekBar?) {}
        }) })
        val ends=LinearLayout(this).apply { orientation=LinearLayout.HORIZONTAL }
        for((index,text) in listOf("10 · Closer matches","20 · Broader search").withIndex())ends.addView(TextView(this).apply { this.text=text;textSize=11f;setTextColor(muted);gravity=if(index==0)Gravity.START else Gravity.END },LinearLayout.LayoutParams(0,-2,1f))
        column.addView(ends,LinearLayout.LayoutParams(-1,-2).apply { bottomMargin=dp(12) })
        button("Capture Image",primary=true) { scan() }
        if(bitmap!=null)button("Review captured image") { review() }
        button("Back to menu") { finish() }
        label("Your photo stays on this device. Only its cover hash is sent to DangerRoom and Metron.",12f).setPadding(0,dp(20),0,0)
    }
    private fun scan() {
        if(busy)return
        busy=true
        GmsDocumentScanning.getClient(GmsDocumentScannerOptions.Builder().setGalleryImportAllowed(false).setPageLimit(1)
            .setResultFormats(GmsDocumentScannerOptions.RESULT_FORMAT_JPEG).setScannerMode(GmsDocumentScannerOptions.SCANNER_MODE_BASE).build())
            .getStartScanIntent(this).addOnSuccessListener { if(!isDestroyed && !isFinishing) capture.launch(IntentSenderRequest.Builder(it).build()) }
            .addOnFailureListener { busy=false;message("Scanner unavailable. Google Play services and its first-use scanner download are required. Please try again after the download completes.") }
    }
    private fun review() {
        val image=bitmap ?: return home()
        screen("Review cover")
        column.addView(ImageView(this).apply { setImageBitmap(image);adjustViewBounds=true;contentDescription="Captured cover";setPadding(dp(8),dp(8),dp(8),dp(8));background=rounded(Color.rgb(24,10,16),border,8) },LinearLayout.LayoutParams(-1,dp(360)))
        button("Search",primary=true) {
            if(busy)return@button
            busy=true;screen("Calculating cover hash…")
            worker.execute {
                try {
                    val pixels=IntArray(image.width*image.height);image.getPixels(pixels,0,image.width,0,0,image.width,image.height)
                    val hash=PerceptualHash.fromArgb(pixels,image.width,image.height)
                    runOnUiThread { if(!isDestroyed) { setResult(RESULT_OK,Intent().putExtra("hash",hash).putExtra("distance",distance));finish() } }
                } catch(error:Exception) { runOnUiThread { if(!isDestroyed) { busy=false;review();message(error.message ?: "Unable to hash image.") } } }
            }
        }
        button("Edit bounding box and rotation") { edit() }
        button("Capture again") { scan() }
        button("Back") { home() }
    }
    private fun edit(original:Bitmap?=bitmap) {
        val image=bitmap ?: return home()
        screen("Edit cover")
        label("Drag the corners of the box to the cover edges. Rotate if needed, then apply.")
        val crop=CropView(image);column.addView(crop,LinearLayout.LayoutParams(-1,dp(420)))
        button("Rotate 90°") {
            val rotated=Bitmap.createBitmap(image,0,0,image.width,image.height,Matrix().apply { postRotate(90f) },true)
            bitmap=rotated;edit(original)
        }
        button("Apply bounding box",primary=true) { bitmap=crop.cropped();review() }
        button("Cancel") { bitmap=original;review() }
    }
    private inner class CropView(private val image:Bitmap):View(this@ImageSearchActivity) {
        private val box=RectF(0f,0f,1f,1f)
        private val display=RectF()
        private val paint=Paint(Paint.ANTI_ALIAS_FLAG)
        private var corner=0
        init { contentDescription="Cover crop box. Drag a corner to adjust.";isFocusable=true }
        override fun onDraw(canvas:Canvas) {
            val scale=minOf(width.toFloat()/image.width,height.toFloat()/image.height)
            val w=image.width*scale;val h=image.height*scale
            display.set((width-w)/2,(height-h)/2,(width+w)/2,(height+h)/2)
            paint.style=Paint.Style.FILL;canvas.drawBitmap(image,null,display,paint)
            val r=RectF(display.left+box.left*w,display.top+box.top*h,display.left+box.right*w,display.top+box.bottom*h)
            paint.color=Color.rgb(229,189,135);paint.strokeWidth=dp(3).toFloat();paint.style=Paint.Style.STROKE;canvas.drawRect(r,paint)
            paint.style=Paint.Style.FILL
            for(x in listOf(r.left,r.right))for(y in listOf(r.top,r.bottom))canvas.drawCircle(x,y,dp(9).toFloat(),paint)
        }
        override fun onTouchEvent(event:MotionEvent):Boolean {
            if(display.width()==0f)return false
            val x=((event.x-display.left)/display.width()).coerceIn(0f,1f)
            val y=((event.y-display.top)/display.height()).coerceIn(0f,1f)
            if(event.action==MotionEvent.ACTION_DOWN) { parent.requestDisallowInterceptTouchEvent(true);corner=(if(x>(box.left+box.right)/2)1 else 0)+(if(y>(box.top+box.bottom)/2)2 else 0) }
            if(event.action==MotionEvent.ACTION_MOVE || event.action==MotionEvent.ACTION_DOWN) {
                if(corner%2==0)box.left=x.coerceAtMost(box.right-.05f) else box.right=x.coerceAtLeast(box.left+.05f)
                if(corner<2)box.top=y.coerceAtMost(box.bottom-.05f) else box.bottom=y.coerceAtLeast(box.top+.05f)
                invalidate()
            }
            if(event.action==MotionEvent.ACTION_UP) { parent.requestDisallowInterceptTouchEvent(false);performClick() }
            return true
        }
        override fun performClick():Boolean { super.performClick();return true }
        fun cropped():Bitmap {
            val left=(box.left*image.width).toInt();val top=(box.top*image.height).toInt()
            return Bitmap.createBitmap(image,left,top,((box.right-box.left)*image.width).toInt().coerceAtLeast(1),((box.bottom-box.top)*image.height).toInt().coerceAtLeast(1))
        }
    }
    override fun onDestroy() { worker.shutdown();super.onDestroy() }
}
