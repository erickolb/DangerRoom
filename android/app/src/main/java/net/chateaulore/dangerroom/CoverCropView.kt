package net.chateaulore.dangerroom

import android.content.Context
import android.graphics.*
import android.view.MotionEvent
import android.view.View
import kotlin.math.*

/** Two draggable corners; crop coordinates stay in the original oriented bitmap. */
class CoverCropView(context: Context, private val bitmap: Bitmap) : View(context) {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val frame = RectF()
    private val crop = RectF(0f, 0f, 1f, 1f)
    private var corner = 0
    init { contentDescription = "Cover crop. Drag the upper left and lower right corners." }
    override fun onDraw(canvas: Canvas) {
        val scale = min(width.toFloat() / bitmap.width, height.toFloat() / bitmap.height)
        val w = bitmap.width * scale; val h = bitmap.height * scale
        frame.set((width-w)/2, (height-h)/2, (width+w)/2, (height+h)/2)
        canvas.drawBitmap(bitmap, null, frame, paint)
        paint.color = Color.RED; paint.style = Paint.Style.STROKE; paint.strokeWidth = 4f
        val r = RectF(frame.left+crop.left*w,frame.top+crop.top*h,frame.left+crop.right*w,frame.top+crop.bottom*h)
        canvas.drawRect(r,paint)
        paint.style = Paint.Style.FILL
        canvas.drawCircle(r.left,r.top,14f,paint); canvas.drawCircle(r.right,r.bottom,14f,paint)
    }
    override fun onTouchEvent(event: MotionEvent): Boolean {
        if (frame.width() <= 0) return false
        val x = ((event.x-frame.left)/frame.width()).coerceIn(0f,1f)
        val y = ((event.y-frame.top)/frame.height()).coerceIn(0f,1f)
        when (event.action) {
            MotionEvent.ACTION_DOWN -> { parent.requestDisallowInterceptTouchEvent(true); corner = if (hypot(x-crop.left,y-crop.top) < hypot(x-crop.right,y-crop.bottom)) 0 else 1 }
            MotionEvent.ACTION_MOVE -> { if (corner == 0) { crop.left=min(x,crop.right-0.05f);crop.top=min(y,crop.bottom-0.05f) } else { crop.right=max(x,crop.left+0.05f);crop.bottom=max(y,crop.top+0.05f) }; invalidate() }
            MotionEvent.ACTION_UP -> { parent.requestDisallowInterceptTouchEvent(false); performClick() }
            MotionEvent.ACTION_CANCEL -> parent.requestDisallowInterceptTouchEvent(false)
        }
        return true
    }
    override fun performClick(): Boolean { super.performClick(); return true }
    override fun onDetachedFromWindow() { super.onDetachedFromWindow(); bitmap.recycle() }
    fun selection(): Bitmap {
        val left = (crop.left*bitmap.width).toInt().coerceIn(0,bitmap.width-1)
        val top = (crop.top*bitmap.height).toInt().coerceIn(0,bitmap.height-1)
        val right = (crop.right*bitmap.width).toInt().coerceIn(left+1,bitmap.width)
        val bottom = (crop.bottom*bitmap.height).toInt().coerceIn(top+1,bitmap.height)
        return Bitmap.createBitmap(bitmap,left,top,right-left,bottom-top).copy(Bitmap.Config.ARGB_8888,false)
    }
}
