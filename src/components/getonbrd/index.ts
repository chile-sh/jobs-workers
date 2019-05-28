import * as tasks from './tasks'
import { create as createSnapshot, setSnapshot } from '../snapshots'
import { SOURCE_NAME, CACHE_SNAPSHOT_KEY } from './constants'
import { redisClients } from './helpers'

const { scrapeData, insertData, getAssets } = tasks

const { db0: redis } = redisClients

export const runTask = async (
  task: {
    run: Function
    TASK_NAME: string
  },
  onProgress: Function = () => {},
  ...rest: any[]
) =>
  task.run((...args: any) => {
    onProgress && onProgress(task.TASK_NAME, ...args)
  }, ...rest)

export const runAllTasks = async (
  onProgress?: Function,
  onTaskEnd: Function = () => {}
) => {
  const snapshot = await createSnapshot(SOURCE_NAME)
  await redis.setJson(CACHE_SNAPSHOT_KEY, snapshot)

  await runTask(scrapeData, onProgress)
  onTaskEnd(scrapeData.TASK_NAME)

  await runTask(insertData, onProgress, snapshot)
  onTaskEnd(insertData.TASK_NAME)

  await runTask(getAssets, onProgress)
  onTaskEnd(getAssets.TASK_NAME)

  await setSnapshot(snapshot.id, SOURCE_NAME)
}

export { tasks }
