import _ from 'lodash'

import {
  createChannel,
  sendToQueue,
  waitForQueuesToEnd
} from '@common/lib/amqplib'
import { logger } from '@common/lib/logger'

import { makeQueues } from '../queues'

import {
  SALARY_STEP,
  SALARY_RANGE,
  QUEUE_GET_SALARIES,
  CACHE_SALARY_RANGE_KEY,
  CACHE_JOBS_QUEUED_KEY,
  CACHE_COMPANIES_KEY,
  CACHE_JOBS_MAP_KEY,
  SOURCE_NAME,
  CONFIG_MAX_PREFETCH
} from '../constants'

import { redisClients } from '../helpers'

const { db0: redis } = redisClients

const makeRanges = (from?: number, to?: number, step: number = SALARY_STEP) =>
  _.times((to - from) / step, (num: number) => [
    from + step * num,
    from + step * (num + 1)
  ])

const ranges = makeRanges(...SALARY_RANGE, SALARY_STEP)

export const TASK_NAME = 'scrape-data'

export const run = async (onProgress?: Function) => {
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
    redisClients.db1.flushdb()
  ])

  ranges.forEach(range =>
    sendToQueue(ch)(QUEUE_GET_SALARIES, { range, offset: 0 })
  )

  await waitForQueuesToEnd(ch, allQueues, { onStatus: onProgress })

  logger.debug(`${SOURCE_NAME}.${TASK_NAME}: queues finished! Cleaning up...`)

  await Promise.all(allQueues.map(q => ch.deleteQueue(q.name)))
  await redis.del(CACHE_JOBS_QUEUED_KEY)

  logger.debug('redis del', CACHE_JOBS_QUEUED_KEY)
  logger.debug(
    `${allQueues
      .map(q => q.name)
      .join(', ')} queues, and ${CACHE_JOBS_QUEUED_KEY} keys removed.`
  )
}
