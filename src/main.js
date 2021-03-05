const { Canvas, Image, ImageData } = require('canvas')
const { JSDOM } = require('jsdom')
const cv = require('../opencv/opencv')

const fs = require('fs')
const os = require('os')
const { convert } = require('./pdf-to-png')
const { rotate } = require('./rotate')

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
          rotate({ dirPath, fileNames })
        })
    )
  }
})

Promise.all(convertPromises).then(() => {
  console.log('all done')
})
