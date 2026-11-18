// Cuts the person out of a photo with macOS Vision and writes the matte as a greyscale PNG
// (white = person). Used by scripts/make-portrait.mjs; needs macOS 14 or newer.
//
//   swift scripts/portrait-mask.swift <photo> <matte.png> [person|subject]
//
// "person" (default) uses the person segmenter at its most accurate setting; "subject" uses the
// foreground-subject lifter, which keeps a harder edge.

import AppKit
import CoreImage
import Foundation
import Vision

let args = CommandLine.arguments
guard args.count >= 3 else {
  FileHandle.standardError.write("usage: portrait-mask <photo> <matte.png> [person|subject]\n".data(using: .utf8)!)
  exit(2)
}

let input = URL(fileURLWithPath: args[1])
let output = URL(fileURLWithPath: args[2])
let mode = args.count > 3 ? args[3] : "person"

guard let image = CIImage(contentsOf: input) else {
  FileHandle.standardError.write("could not read \(input.path)\n".data(using: .utf8)!)
  exit(1)
}

let handler = VNImageRequestHandler(ciImage: image, options: [:])
var matte: CIImage

if mode == "subject" {
  let request = VNGenerateForegroundInstanceMaskRequest()
  try handler.perform([request])
  guard let result = request.results?.first else {
    FileHandle.standardError.write("no foreground subject found\n".data(using: .utf8)!)
    exit(1)
  }
  let buffer = try result.generateScaledMaskForImage(forInstances: result.allInstances, from: handler)
  matte = CIImage(cvPixelBuffer: buffer)
} else {
  let request = VNGeneratePersonSegmentationRequest()
  request.qualityLevel = .accurate
  request.outputPixelFormat = kCVPixelFormatType_OneComponent8
  try handler.perform([request])
  guard let buffer = request.results?.first?.pixelBuffer else {
    FileHandle.standardError.write("no person found\n".data(using: .utf8)!)
    exit(1)
  }
  matte = CIImage(cvPixelBuffer: buffer)
}

// The matte may come back at the model's own size: scale it to the photo.
let scaleX = image.extent.width / matte.extent.width
let scaleY = image.extent.height / matte.extent.height
matte = matte.transformed(by: CGAffineTransform(scaleX: scaleX, y: scaleY))

let context = CIContext()
guard let grey = CGColorSpace(name: CGColorSpace.genericGrayGamma2_2) else { exit(1) }
try context.writePNGRepresentation(of: matte, to: output, format: .L8, colorSpace: grey)
print("matte \(Int(image.extent.width))x\(Int(image.extent.height)) -> \(output.path)")
