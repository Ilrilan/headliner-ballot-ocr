const { createCanvas, loadImage } = require('canvas')
const { writeFileSync } = require('fs')

const topLeftPath = '/patterns/squareTopLeft.png'
const topRightPath = '/patterns/squareTopRight.png'
const bottomLeftPath = '/patterns/squareBottomLeft.png'
const bottomRightPath = '/patterns/squareBottomRight.png'

let topLeftImg
let topRightImg
let bottomLeftImg
let bottomRightImg

function calcLengthByPoints(p1, p2) {
  return Math.sqrt((p2.x - p1.x) * (p2.x - p1.x) + (p2.y - p1.y) * (p2.y - p1.y))
}

async function waitInitialize() {
  if (!topLeftImg) {
    topLeftImg = await getCvImage(currentPath + topLeftPath)
  }
  if (!topRightImg) {
    topRightImg = await getCvImage(currentPath + topRightPath)
  }
  if (!bottomLeftImg) {
    bottomLeftImg = await getCvImage(currentPath + bottomLeftPath)
  }
  if (!bottomRightImg) {
    bottomRightImg = await getCvImage(currentPath + bottomRightPath)
  }
}

async function getCvImage(filePath) {
  const png = await loadImage(filePath)
  const cvImage = cv.imread(png)
  const dst = new cv.Mat()
  cv.cvtColor(cvImage, dst, cv.COLOR_RGBA2GRAY, 0)
  cvImage.delete()
  return dst
}

function getTemplatePosition({ cvImage, cvTemplate, dirPath, templateName }) {
  const dst = new cv.Mat()
  cv.matchTemplate(cvImage, cvTemplate, dst, cv.TM_CCORR_NORMED)
  /*if (process.env.WRITE_DEBUG_FILES) {
    const canvas = createCanvas(600, 600)
    cv.imshow(canvas, dst)
    writeFileSync(dirPath + '/matchTemplate_' + templateName + '.png', canvas.toBuffer('image/png'))
  }*/
  const result = cv.minMaxLoc(dst)
  dst.delete()
  return result.maxLoc
}

async function rotateFile({ dirPath, fileName }) {
  const grayImg = await getCvImage(dirPath + '/' + fileName)
  const dsize = new cv.Size(grayImg.cols, grayImg.rows)
  const edgesImg = new cv.Mat()

  let M = cv.Mat.ones(5, 5, cv.CV_8U)
  let anchor = new cv.Point(-1, -1)
  cv.dilate(grayImg, edgesImg, M, anchor, 1, cv.BORDER_CONSTANT, cv.morphologyDefaultBorderValue())

  const color = new cv.Scalar(255, 255, 255)

  const quartX = grayImg.cols / 4
  const quartY = grayImg.rows / 4

  const topLeftPart = new cv.Mat()
  grayImg.copyTo(topLeftPart)
  cv.rectangle(topLeftPart, new cv.Point(quartX, 0), new cv.Point(grayImg.cols, grayImg.rows), color, -1)
  cv.rectangle(topLeftPart, new cv.Point(0, quartX), new cv.Point(grayImg.cols, grayImg.rows), color, -1)

  const topRightPart = new cv.Mat()
  grayImg.copyTo(topRightPart)
  cv.rectangle(topRightPart, new cv.Point(0, 0), new cv.Point(grayImg.cols - quartX, grayImg.rows), color, -1)
  cv.rectangle(topRightPart, new cv.Point(0, quartY), new cv.Point(grayImg.cols, grayImg.rows), color, -1)

  const bottomLeftPart = new cv.Mat()
  grayImg.copyTo(bottomLeftPart)
  cv.rectangle(bottomLeftPart, new cv.Point(quartX, 0), new cv.Point(grayImg.cols, grayImg.rows), color, -1)
  cv.rectangle(bottomLeftPart, new cv.Point(0, 0), new cv.Point(grayImg.cols, grayImg.rows - quartY), color, -1)

  const bottomRightPart = new cv.Mat()
  grayImg.copyTo(bottomRightPart)
  cv.rectangle(bottomRightPart, new cv.Point(0, 0), new cv.Point(grayImg.cols - quartX, grayImg.rows), color, -1)
  cv.rectangle(bottomRightPart, new cv.Point(0, 0), new cv.Point(grayImg.cols, grayImg.rows - quartY), color, -1)

  const positions = {
    topLeft: getTemplatePosition({ cvImage: topLeftPart, cvTemplate: topLeftImg, dirPath, templateName: 'topLeft' }),
    topRight: getTemplatePosition({
      cvImage: topRightPart,
      cvTemplate: topRightImg,
      dirPath,
      templateName: 'topRight',
    }),
    bottomLeft: getTemplatePosition({
      cvImage: bottomLeftPart,
      cvTemplate: bottomLeftImg,
      dirPath,
      templateName: 'bottomLeft',
    }),
    bottomRight: getTemplatePosition({
      cvImage: bottomRightPart,
      cvTemplate: bottomRightImg,
      dirPath,
      templateName: 'bottomRight',
    }),
  }
  const { topLeft, topRight, bottomLeft } = positions
  const resultHeight = calcLengthByPoints(topLeft, bottomLeft)
  let rotationMatrix
  let resultRect
  if (topRight.y > topLeft.y) {
    const p = {
      x: topRight.x,
      y: topLeft.y,
    }
    const adjacentLength = calcLengthByPoints(topLeft, p)
    const hipotenuseLength = calcLengthByPoints(topLeft, topRight)
    const cosAlpha = adjacentLength / hipotenuseLength
    const alpha = (Math.acos(cosAlpha) * 180) / Math.PI
    rotationMatrix = cv.getRotationMatrix2D(topLeft, alpha, 1)
    resultRect = new cv.Rect(topLeft.x - 20, topLeft.y + 90, hipotenuseLength + 100, resultHeight - 180)
  } else {
    const p = {
      x: topLeft.x,
      y: topRight.y,
    }
    const adjacentLength = calcLengthByPoints(topRight, p)
    const hipotenuseLength = calcLengthByPoints(topLeft, topRight)
    const cosAlpha = adjacentLength / hipotenuseLength
    const alpha = (Math.acos(cosAlpha) * -180) / Math.PI
    rotationMatrix = cv.getRotationMatrix2D(topRight, alpha, 1)
    resultRect = new cv.Rect(topRight.x - hipotenuseLength, topRight.y + 90, hipotenuseLength + 60, resultHeight - 180)
  }
  const rotatedImg = new cv.Mat()
  cv.warpAffine(grayImg, rotatedImg, rotationMatrix, dsize)
  const croppedImg = rotatedImg.roi(resultRect)

  if (process.env.WRITE_DEBUG_FILES) {
    const canvas = createCanvas(600, 600)
    cv.imshow(canvas, croppedImg)
    writeFileSync(dirPath + '/rotated_' + fileName, canvas.toBuffer('image/png'))
  }

  grayImg.delete()
  edgesImg.delete()
  rotatedImg.delete()
  return croppedImg
}

async function rotate({ dirPath, fileNames }) {
  await waitInitialize()
  const rotations = []
  fileNames.forEach((fileName) => {
    rotations.push(rotateFile({ dirPath, fileName }))
  })
  return await Promise.all(rotations)

  // we create an object compatible HTMLCanvasElement
  /*const canvas = createCanvas(600, 600)
  cv.imshow(canvas, dst)
  writeFileSync(dirPath + 'output.png', canvas.toBuffer('image/png'))*/
}

module.exports = {
  rotate,
}
