const fs = require('fs')
const os = require('os')
const { convert } = require('./pdf-to-png')

const pathToUnixPath = os.platform() === 'win32' ? (str) => str.replace(/\\/g, '/') : (str) => str

const currentPath = pathToUnixPath(process.cwd())

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
      convert({ filePath, dirPath }).then(() => {
        console.log(`${filePath} converted`)
      })
    )
  }
})

Promise.all(convertPromises).then(() => {
  console.log('all done')
})
