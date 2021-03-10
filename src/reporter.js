const fs = require('fs')
const os = require('os')

const pathToUnixPath = os.platform() === 'win32' ? (str) => str.replace(/\\/g, '/') : (str) => str

const currentPath = pathToUnixPath(process.cwd())

const reportDir = currentPath + '/reports'
const paths = fs.readdirSync(reportDir)

const KindCodes = {
  0: 'ЗА',
  1: 'ПРОТИВ',
  2: 'ВОЗДЕРЖАЛСЯ',
}
KindCodes[-1] = 'ИГНОРИРОВАЛ'
KindCodes[-2] = 'ОШИБКА РАСПОЗНАВАНИЯ'

const report = []
const errorsLog = []

paths.forEach((pathStr) => {
  const filePath = reportDir + '/' + pathStr
  if (fs.existsSync(filePath) && filePath.indexOf('.json') !== -1) {
    const votesLog = require(filePath)
    if (!votesLog.attrs || !votesLog.votes) {
      errorsLog.push(`Error in file ${pathStr}: required attributes missed`)
    }
    const { vault = '', flat = '', parking = '' } = votesLog.attrs
    const votesArr = Object.values(votesLog.votes).map((kind) => KindCodes[kind])
    report.push(`${flat},${parking},${vault},${votesArr.join(',')}`)
  }
})

fs.writeFileSync(currentPath + '/report.txt', report.join('\n'))
if (errorsLog.length > 0) {
  console.log(`Errors: \n\n${errorsLog.join('\n')}`)
} else {
  console.log(`Report generated succesfull, total ${report.length} logs`)
}
