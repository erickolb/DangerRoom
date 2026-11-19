import Foundation
import UIKit

/// ImageHash-compatible pHash; same Pillow luminance/Lanczos and DCT as Android.
enum PerceptualHash {
    private static let n = 32
    private static let precision = 1 << 22
    private static let cosines: [[Double]] = (0..<8).map { k in (0..<32).map { x in
        let angle = Double.pi * Double((2*x+1)*k) / 64.0
        return cos(angle)
    } }
    private struct Kernel { let start: Int; let weights: [Int] }
    private static func sinc(_ x: Double) -> Double { x == 0 ? 1 : sin(.pi*x)/(.pi*x) }
    private static func kernels(_ size: Int) -> [Kernel] {
        let scale = Double(size)/Double(n), filterScale = max(1, Double(size)/Double(n)), support = 3*filterScale
        return (0..<n).map { target in
            let center = (Double(target)+0.5)*scale
            let start = max(0, Int(center-support+0.5)), end = min(size, Int(center+support+0.5))
            let weights = (start..<end).map { position -> Double in
                let x = (Double(position)-center+0.5)/filterScale
                return abs(x)<3 ? sinc(x)*sinc(x/3) : 0
            }
            let sum = weights.reduce(0,+)
            return Kernel(start: start, weights: weights.map { value in
                let weight = value/sum*Double(precision)
                return Int(weight + (weight<0 ? -0.5 : 0.5))
            })
        }
    }
    static func fromARGB(_ pixels: [UInt32], width: Int, height: Int) throws -> String {
        guard width>0, height>0, width<=32_000_000/height, pixels.count==width*height else { throw ClientError(message: "Invalid cover image.") }
        let gray: [Int] = pixels.map { pixel in
            let red = Int((pixel>>16)&255), green = Int((pixel>>8)&255), blue = Int(pixel&255)
            return (red*19595 + green*38470 + blue*7471 + 32768)>>16
        }
        func resizeX(_ input: [Int], _ w: Int, _ h: Int) -> [Int] {
            if w==n { return input }
            let filters = kernels(w); var output = [Int](repeating: 0, count: n*h)
            for y in 0..<h { for x in 0..<n {
                let kernel = filters[x]; var sum = 1 << 21
                for j in kernel.weights.indices { sum += input[y*w+kernel.start+j]*kernel.weights[j] }
                output[y*n+x] = min(255,max(0,sum>>22))
            } }
            return output
        }
        func resizeY(_ input: [Int], _ w: Int, _ h: Int) -> [Int] {
            if h==n { return input }
            let filters = kernels(h); var output = [Int](repeating: 0,count: w*n)
            for y in 0..<n { for x in 0..<w {
                let kernel = filters[y]; var sum = 1 << 21
                for j in kernel.weights.indices { sum += input[(kernel.start+j)*w+x]*kernel.weights[j] }
                output[y*w+x] = min(255,max(0,sum>>22))
            } }
            return output
        }
        let resized = height-n>0 && height-n>(width-n)*2 ? resizeX(resizeY(gray,width,height),width,n) : resizeY(resizeX(gray,width,height),n,height)
        var vertical = [[Double]](repeating: [Double](repeating: 0,count: n),count: 8)
        for k in 0..<8 { for x in 0..<n { for y in 0..<n { vertical[k][x] += Double(resized[y*n+x])*cosines[k][y]*2 } } }
        var dct = [Double](repeating: 0,count: 64)
        for y in 0..<8 { for x in 0..<8 {
            var sum = 0.0
            for j in 0..<n { sum += vertical[y][j]*cosines[x][j]*2 }
            dct[y*8+x] = abs(sum)<1e-7 ? 0 : sum
        } }
        let sorted = dct.sorted(), median = (sorted[31]+sorted[32])/2
        var hash: UInt64 = 0
        for value in dct { hash = (hash<<1) | (value>median ? 1 : 0) }
        return String(format: "%016llx",hash)
    }
    static func image(_ image: UIImage) throws -> String {
        let pixelWidth = image.size.width*image.scale, pixelHeight = image.size.height*image.scale
        guard pixelWidth>0, pixelHeight>0, pixelWidth*pixelHeight<=32_000_000 else { throw ClientError(message: "Cover image too large or unreadable. Please recapture it.") }
        var sample: CGFloat = 1
        while pixelWidth*pixelHeight/(sample*sample)>4_000_000 { sample *= 2 }
        let width = max(1,Int(pixelWidth/sample)), height = max(1,Int(pixelHeight/sample))
        let format = UIGraphicsImageRendererFormat(); format.scale = 1; format.opaque = true
        let upright = UIGraphicsImageRenderer(size: CGSize(width: width,height: height),format: format).image { context in
            UIColor.white.setFill(); context.fill(CGRect(x: 0,y: 0,width: width,height: height))
            image.draw(in: CGRect(x: 0,y: 0,width: width,height: height))
        }
        guard let cg = upright.cgImage else { throw ClientError(message: "Unable to read captured cover.") }
        var bytes = [UInt8](repeating: 0,count: width*height*4)
        let drawn = bytes.withUnsafeMutableBytes { buffer -> Bool in
            guard let context = CGContext(data: buffer.baseAddress,width: width,height: height,bitsPerComponent: 8,bytesPerRow: width*4,space: CGColorSpaceCreateDeviceRGB(),bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue) else { return false }
            context.draw(cg,in: CGRect(x: 0,y: 0,width: width,height: height)); return true
        }
        guard drawn else { throw ClientError(message: "Unable to process captured cover.") }
        let pixels: [UInt32] = stride(from: 0,to: bytes.count,by: 4).map { i in
            let red = UInt32(bytes[i]), green = UInt32(bytes[i+1]), blue = UInt32(bytes[i+2])
            return 0xff000000 | (red<<16) | (green<<8) | blue
        }
        return try fromARGB(pixels,width: width,height: height)
    }
}
