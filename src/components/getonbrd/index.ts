import * as tasks from './tasks'

const run = async (onProgress?: Function, onEnd?: Function) => {
  await tasks.scrapeData(onProgress)
  await tasks.insertData(onProgress)
  await tasks.getAssets(onProgress)

  onEnd && onEnd()
}

export { tasks, run }
