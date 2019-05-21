import _ from 'lodash'

import {
  createChannel,
  sendToQueue,
  waitForQueuesToEnd
} from '@common/lib/amqplib'
import { defaultClient as redis } from '@common/lib/redis'
import { logger } from '@common/lib/logger'

import { makeQueues } from '../queues'

import {
  SALARY_STEP,
  SALARY_RANGE,
  QUEUE_GET_SALARIES,
  CACHE_SALARY_RANGE_KEY,
  CACHE_JOBS_QUEUED_KEY,
  CACHE_SALARIES_MAP_KEY,
  CACHE_COMPANIES_KEY,
  CACHE_JOBS_MAP_KEY,
  SOURCE_NAME,
  CONFIG_MAX_PREFETCH
} from '../constants'

const makeRanges = (from?: number, to?: number, step: number = SALARY_STEP) =>
  _.times((to - from) / step, (num: number) => [
    from + step * num,
    from + step * (num + 1)
  ])

const ranges = makeRanges(...SALARY_RANGE, SALARY_STEP)

const TASK_NAME = `${SOURCE_NAME}.scrape-data`

export const run = async (onStatus?: Function, onEnd?: Function) => {
  const ch = await createChannel(CONFIG_MAX_PREFETCH)
  const queues = await makeQueues(ch)

  const allQueues = Object.keys(queues).map(k => queues[k])

  await Promise.all(
    allQueues.map(async q => {
      await ch.assertQueue(q.name)
      await ch.purgeQueue(q.name)

      q.run()
    })
  )

  await Promise.all([
    redis.setKeyExp(CACHE_COMPANIES_KEY, '1 week', true, '1h'),
    redis.setKeyExp(CACHE_JOBS_MAP_KEY, '2 days', true, '1h'),
    redis.setKeyExp(CACHE_SALARY_RANGE_KEY, '4 hours', true, '1h'),
    redis.del(CACHE_JOBS_QUEUED_KEY),
    redis.del(CACHE_SALARIES_MAP_KEY)
  ])

  // Get min and max items to exclude their salary
  // since they appear on the entire range
  const fullRange = [[0, 0], [20000, 20000], ...ranges]

  fullRange.forEach(range =>
    sendToQueue(ch)(QUEUE_GET_SALARIES, { range, offset: 0 })
  )

  return waitForQueuesToEnd(ch, allQueues, {
    onStatus,
    onEnd: async () => {
      logger.info(`${SOURCE_NAME}: queues finished! Cleaning up...`)

      await Promise.all(allQueues.map(q => ch.deleteQueue(q.name)))
      await redis.del(CACHE_JOBS_QUEUED_KEY)
      console.log('redis del', CACHE_JOBS_QUEUED_KEY)
      logger.info(
        `${allQueues
          .map(q => q.name)
          .join(', ')} queues, and ${CACHE_JOBS_QUEUED_KEY} keys removed.`
      )

      logger.info(`${TASK_NAME}: done!`)
    }
  })
}
