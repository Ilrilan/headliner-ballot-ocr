const { Canvas, Image, ImageData } = require('canvas')
const { JSDOM } = require('jsdom')
const cv = require('../opencv/opencv')

const fs = require('fs')
const os = require('os')
const { convert } = require('./pdf-to-png')
const { rotate } = require('./rotate')
const { calcVotes } = require('./calc-votes')

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

const getPrintableVotes = (votes) => {
  return votes.map(
    (vote) => `Вопрос #${vote.num + 1}: ${vote.kind === 0 ? 'ЗА' : vote.kind === 1 ? 'ПРОТИВ' : 'ВОЗДЕРЖАЛСЯ'}`
  )
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
          fs.writeFileSync(dirPath + 'votes.txt', getPrintableVotes(votesResult).join('\n'))
        })
    )
  }
})

Promise.all(convertPromises).then(() => {
  console.log('all done')
})
