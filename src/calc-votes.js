const fs = require('fs/promises')
const { createCanvas } = require('canvas')

const emptyVotePath = '/patterns/squareTopLeft.png'

function findGrayAreas(cvImg) {
  let dst = new cv.Mat()
  let M = cv.Mat.ones(5, 5, cv.CV_8U)
  let anchor = new cv.Point(-1, -1)
  cv.dilate(cvImg, dst, M, anchor, 1, cv.BORDER_CONSTANT, cv.morphologyDefaultBorderValue())
  const contours = new cv.MatVector()
  const hierarchy = new cv.Mat()
  cv.findContours(dst, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE)
  console.log(contours.size())
  for (let i = 0; i < contours.size(); ++i) {
    let color = new cv.Scalar(128, 128, 128)
    cv.drawContours(dst, contours, i, color, 1, cv.LINE_8, hierarchy, 100)
  }
  contours.delete()
  hierarchy.delete()
  return dst
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
