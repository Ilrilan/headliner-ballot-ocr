const fs = require('fs/promises')
const { createCanvas } = require('canvas')

function getContours(cvImage) {
  const contours = new cv.MatVector()
  const hierarchy = new cv.Mat()
  cv.findContours(cvImage, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE)
  hierarchy.delete()
  return contours
}

function mathSort(arr) {
  return arr.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}

function getMedianArray(arr, delta = 40) {
  const res = []
  res.push(Math.min(...arr))
  mathSort(arr).forEach((el) => {
    if (el - res[res.length - 1] >= delta) {
      res.push(el)
    }
  })
  return res
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
  symbolsMask.delete()
  contoursBlack.delete()
  contoursWhite.delete()
  return res
}

function calcVoteResults({ valuedImage, index }) {
  const thr = new cv.Mat()
  cv.threshold(valuedImage, thr, 240, 255, cv.THRESH_BINARY)
  const contours = getContours(thr)
  const results = []
  let votes = []
  const color = new cv.Scalar(128, 128, 128)
  for (let i = 0; i < contours.size(); ++i) {
    const cnt = contours.get(i)
    const rect = cv.boundingRect(cnt)
    if (rect.width > 40 && rect.height > 40) {
      const sq = thr.roi(rect)
      const nonZeroPixelsPercent = cv.countNonZero(sq) / (rect.width * rect.height)
      const vote = nonZeroPixelsPercent < 0.96
      if (vote) {
        cv.rectangle(
          thr,
          new cv.Point(rect.x + 2, rect.y + 2),
          new cv.Point(rect.x + rect.width - 4, rect.y + rect.height - 4),
          color,
          -1
        )
      }
      results.push({
        x: rect.x,
        y: rect.y,
        vote,
        percent: nonZeroPixelsPercent,
      })
    }
  }
  const xArr = []
  const yArr = []
  results.forEach((voteField) => {
    xArr.push(voteField.x)
    yArr.push(voteField.y)
  })
  let medianX = getMedianArray(xArr)
  if (medianX.length === 2) {
    if (medianX.filter((el) => el < 970).length === 0) {
      medianX.push(920)
    } else if (medianX.filter((el) => el > 970 && el < 1100)) {
      medianX.push(1011)
    } else {
      medianX.push(1130)
    }
    medianX = mathSort(medianX)
  }
  const medianY = getMedianArray(yArr)
  results.forEach((voteField) => {
    const x = medianX.find((el) => voteField.x - el < 40)
    const y = medianY.find((el) => voteField.y - el < 40)
    if (voteField.vote) {
      votes.push({
        num: medianY.indexOf(y),
        kind: medianX.indexOf(x),
        percent: voteField.percent,
      })
    }
    voteField.x = x
    voteField.y = y
  })
  votes = votes.filter((vote) => {
    const votesSameNum = votes.filter((v) => v.num === vote.num)
    if (votesSameNum.length === 1) {
      return true
    }
    const votesLessThan90 = votesSameNum.filter((v) => v.percent < 0.93)
    if (votesLessThan90.length > 1) {
      votesLessThan90.forEach((v) => {
        v.kind = -2
      })
    }
    const minPercent = Math.min(...votesSameNum.map((vote) => vote.percent))
    return vote.percent === minPercent
  })
  if (medianY.length > votes.length) {
    medianY.forEach((el, index) => {
      if (!votes.find((vote) => vote.num === index)) {
        const numResults = results.filter((result) => result.y === el)
        if (numResults.length === 3) {
          votes.push({
            num: index,
            kind: -1,
          })
        } else if (numResults.length === 2) {
          const xCoord = medianX.find((x) => numResults.filter((result) => result.x === x).length === 0)
          votes.push({
            num: index,
            kind: medianX.indexOf(xCoord),
          })
        }
      }
    })
  }
  votes.forEach((vote) => {
    delete vote.percent
  })
  return {
    cvImg: thr,
    results,
    votes,
  }
}

async function calcVotes({ dirPath, croppedImages }) {
  const promises = []
  let votes = []
  croppedImages.forEach((cvImg, index) => {
    if (index === 0) {
      cv.rectangle(cvImg, new cv.Point(0, 0), new cv.Point(1400, 1300), new cv.Scalar(0, 0, 0), -1)
    } else {
      cv.rectangle(cvImg, new cv.Point(0, 0), new cv.Point(850, 1650), new cv.Scalar(0, 0, 0), -1)
    }
    const valuedImage = findGrayAreas(cvImg)
    if (process.env.WRITE_DEBUG_FILES) {
      const canvas = createCanvas(600, 600)
      cv.imshow(canvas, valuedImage)
      promises.push(fs.writeFile(dirPath + '/valuedImage_' + index + '.png', canvas.toBuffer('image/png')))
    }
    const calcResult = calcVoteResults({ valuedImage, index })
    if (process.env.WRITE_DEBUG_FILES) {
      const canvas = createCanvas(600, 600)
      cv.imshow(canvas, calcResult.cvImg)
      promises.push(fs.writeFile(dirPath + '/votesImage_' + index + '.png', canvas.toBuffer('image/png')))
    }
    calcResult.cvImg.delete()
    votes[index] = calcResult.votes
  })
  await Promise.all(promises)
  let prevVotesCount = 0
  votes.forEach((votesPage) => {
    votesPage.forEach((vote) => {
      vote.num += prevVotesCount
    })
    prevVotesCount += votesPage.length
  })
  return votes.flat().sort((a, b) => (a.num < b.num ? -1 : a.num > b.num ? 1 : 0))
}

module.exports = {
  calcVotes,
}
