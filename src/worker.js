// This is only used in development, this file won't be included in the bundle
// so we won't be importing `ts-node`
const path = require('path')
const { workerData } = require('worker_threads')

require('ts-node').register()
require(path.resolve(__dirname, workerData.path))
