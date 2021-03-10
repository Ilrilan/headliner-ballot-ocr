const { Canvas, Image, ImageData } = require('canvas')
const { JSDOM } = require('jsdom')
const cv = require('../opencv/opencv')

const fs = require('fs')
const os = require('os')
const { convert } = require('./pdf-to-png')
const { rotate } = require('./rotate')
const { calcVotes } = require('./calc-votes')

const errorsLog = []

process.env.WRITE_DEBUG_FILES = true

const pathToUnixPath = os.platform() === 'win32' ? (str) => str.replace(/\\/g, '/') : (str) => str

const currentPath = pathToUnixPath(process.cwd())

function installDOM() {
  const dom = new JSDOM()
  global.document = dom.window.document
  // The rest enables DOM image and canvas and is provided by node-canvas
  global.Image = Image
  global.HTMLCanvasElement = Canvas
  global.ImageData = ImageData
  global.HTMLImageElement = Image
  global.cv = cv
  global.currentPath = currentPath
}
installDOM()

const pdfDir = currentPath + '/pdf'
const paths = fs.readdirSync(pdfDir)

const convertPromises = []

const KindCodes = {
  0: 'ЗА',
  1: 'ПРОТИВ',
  2: 'ВОЗДЕРЖАЛСЯ',
}
KindCodes[-1] = 'ИГНОРИРОВАЛ'
KindCodes[-2] = 'ОШИБКА РАСПОЗНАВАНИЯ'

const getPrintableVotes = (votes) => {
  return votes.map((vote) => {
    return `Вопрос #${vote.num + 1}: ${KindCodes[vote.kind]}`
  })
}

const getJSONVotes = (votes) => {
  const result = {}
  votes.forEach((vote) => {
    result[vote.num + 1] = vote.kind
  })
  return result
}

paths.forEach((pathStr) => {
  const filePath = pdfDir + '/' + pathStr
  if (fs.existsSync(filePath) && filePath.indexOf('.pdf') !== -1) {
    const dirPath = filePath.replace('.pdf', '') + '/'
    if (fs.existsSync(dirPath)) {
      fs.rmdirSync(dirPath, { recursive: true })
    }
    fs.mkdirSync(dirPath)

    convertPromises.push(
      convert({ filePath, dirPath })
        .then(() => {
          const fileNames = fs.readdirSync(dirPath)
          return fileNames
        })
        .then((fileNames) => {
          return rotate({ dirPath, fileNames })
        })
        .then((croppedImages) => {
          return calcVotes({ dirPath, croppedImages })
        })
        .then((votesResult) => {
          recErrors = votesResult.filter((v) => v.kind === -2)
          if (recErrors.length > 0) {
            errorsLog.push(`Recognition errors in file "${pathStr}", votes: ${recErrors.map((v) => v.num).join(',')}`)
          }
          if (votesResult.length !== 34) {
            errorsLog.push(`Error in file "${pathStr}", counted ${votesResult.length} votes`)
          }
          if (votesResult.filter((vote) => vote.kind !== -1).length === 0) {
            errorsLog.push(`Error in file "${pathStr}", no votes!`)
          }
          fs.writeFileSync(dirPath + 'votes.json', JSON.stringify(getJSONVotes(votesResult), undefined, 2))
          fs.writeFileSync(dirPath + 'votes.txt', getPrintableVotes(votesResult).join('\n'))
        })
    )
  }
})

Promise.all(convertPromises).then(() => {
  console.log('all done')
  console.log(errorsLog.length === 0 ? 'no errors' : errorsLog.join('\n'))
})
