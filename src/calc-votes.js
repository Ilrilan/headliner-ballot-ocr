const fs = require('fs/promises')
const { createCanvas } = require('canvas')

const emptyVotePath = '/patterns/squareTopLeft.png'

function getContours(cvImage) {
  const contours = new cv.MatVector()
  const hierarchy = new cv.Mat()
  cv.findContours(cvImage, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE)
  hierarchy.delete()
  return contours
}

function findGrayAreas(cvImg) {
  let dst = new cv.Mat()
  let M = cv.Mat.ones(5, 5, cv.CV_8U)
  let anchor = new cv.Point(-1, -1)
  cv.dilate(cvImg, dst, M, anchor, 1, cv.BORDER_CONSTANT, cv.morphologyDefaultBorderValue())
  const blurred = new cv.Mat()
  const ksize = new cv.Size(9, 9)
  cv.GaussianBlur(dst, blurred, ksize, 0, 0, cv.BORDER_DEFAULT)
  const thr = new cv.Mat()
  cv.threshold(blurred, thr, 235, 255, cv.THRESH_BINARY)
  const contoursBlack = getContours(thr)
  const color = new cv.Scalar(255, 255, 255)
  const mask = cv.Mat.zeros(cvImg.rows, cvImg.cols, cvImg.type())
  for (let i = 0; i < contoursBlack.size(); ++i) {
    const cnt = contoursBlack.get(i)
    const rect = cv.boundingRect(cnt)
    if (
      rect.width > 100 &&
      rect.height > 100 &&
      (rect.x !== 0 || rect.y !== 0 || rect.width !== thr.cols || rect.height !== thr.rows)
    ) {
      cv.rectangle(
        mask,
        new cv.Point(rect.x, rect.y),
        new cv.Point(rect.x + rect.width, rect.y + rect.height),
        color,
        -1
      )
    }
  }
  const thrMasked = new cv.Mat()
  thr.copyTo(thrMasked, mask)

  const symbolsMask = cv.Mat.zeros(cvImg.rows, cvImg.cols, cvImg.type())
  const contoursWhite = getContours(thrMasked)
  for (let i = 0; i < contoursWhite.size(); ++i) {
    const cnt = contoursWhite.get(i)
    const rect = cv.boundingRect(cnt)
    if (rect.width > 20 && rect.height > 20 && rect.width < 200 && rect.height < 200) {
      cv.rectangle(
        symbolsMask,
        new cv.Point(rect.x + 2, rect.y + 2),
        new cv.Point(rect.x + rect.width - 4, rect.y + rect.height - 4),
        color,
        -1
      )
    }
  }
  const res = new cv.Mat()
  cvImg.copyTo(res, symbolsMask)

  dst.delete()
  blurred.delete()
  thr.delete()
  mask.delete()
  contoursBlack.delete()
  return res
}

async function calcVotes({ dirPath, croppedImages }) {
  const promises = []
  croppedImages.forEach((cvImg, index) => {
    const dilatedImg = findGrayAreas(cvImg)
    const canvas = createCanvas(600, 600)
    cv.imshow(canvas, dilatedImg)
    promises.push(fs.writeFile(dirPath + '/dilated_' + index + '.png', canvas.toBuffer('image/png')))
  })
  await Promise.all(promises)
}

module.exports = {
  calcVotes,
}
