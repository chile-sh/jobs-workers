import GetOnBrd from '@chile-sh/getonbrd-scraper'

import { sendToQueue } from '@common/lib/amqplib'

import config from '@/config'

import {
  QUEUE_GET_SALARIES,
  QUEUE_GET_JOBS,
  CACHE_JOBS_QUEUED_KEY,
  CACHE_SESSION_KEY,
  CACHE_SALARY_RANGE_KEY,
  CACHE_SALARY_MAP_KEY
} from '../constants'

import { redisClients } from '../helpers'

const { db0: redis } = redisClients

const gob = (async () => {
  let session = await redis.get(CACHE_SESSION_KEY)

  if (!session) {
    session = config.bots.getonbrd.session
    await redis.set(CACHE_SESSION_KEY, session)
  }

  return GetOnBrd(session)
})()

export default async (msg: any, ch: any) => {
  if (!msg) return false

  const params = msg.content.toString()
  const { range, offset } = JSON.parse(params)
  const [from, to] = range

  let res = await redis.hgetJson(CACHE_SALARY_RANGE_KEY, params)

  if (!res) {
    res = await (await gob).getJobsBySalary(from, to, offset)
  }

  const { urls, next } = res

  redis.hsetJson(CACHE_SALARY_RANGE_KEY, params, res)

  await Promise.all(
    urls.map(async (url: string) => {
      const queued = await redis.sismember(CACHE_JOBS_QUEUED_KEY, url)
      if (!queued) await sendToQueue(ch)(QUEUE_GET_JOBS, url)

      await redis.sadd(CACHE_JOBS_QUEUED_KEY, urls)

      await redisClients.db1.sadd(`${CACHE_SALARY_MAP_KEY}:${url}`, range)
    })
  )

  if (next) {
    sendToQueue(ch)(QUEUE_GET_SALARIES, {
      range,
      offset: offset + 25
    })
  }

  await ch.ack(msg)
}
