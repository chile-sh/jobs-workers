import * as tasks from './tasks'

const { scrapeData, insertData, getAssets } = tasks

export const runTask = async (
  task: {
    run: Function
    TASK_NAME: string
  },
  onProgress: Function = () => {}
) =>
  task.run((...args: any) => {
    onProgress && onProgress(task.TASK_NAME, ...args)
  })

export const runAllTasks = async (onProgress?: Function, onEnd?: Function) => {
  await runTask(scrapeData, onProgress)
  await runTask(insertData, onProgress)
  await runTask(getAssets, onProgress)

  onEnd && onEnd()
}

export { tasks }
