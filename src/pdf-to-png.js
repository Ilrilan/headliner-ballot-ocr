const pdf = require('pdf-poppler')
const path = require('path')

async function convert({ filePath, dirPath }) {
  const fileName = path.basename(filePath)
  let opts = {
    format: 'png',
    out_dir: dirPath,
    scale: 2048,
    out_prefix: fileName,
  }

  const fileNames = await pdf.convert(filePath, opts)
  return fileNames
}

module.exports = {
  convert,
}
