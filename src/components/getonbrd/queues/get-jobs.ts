import GetOnBrd from '@chile-sh/getonbrd-scraper'

import { sendToQueue } from '@common/lib/amqplib'
import { defaultClient as redis } from '@common/lib/redis'

import {
  CACHE_JOBS_MAP_KEY,
  QUEUE_GET_COMPANIES,
  CACHE_COMPANIES_KEY
} from '../constants'

export default async (msg: any, ch: any) => {
  if (!msg) return false

  const jobUrl = JSON.parse(msg.content.toString())
  let jobInfo = await redis.hgetJson(CACHE_JOBS_MAP_KEY, jobUrl)

  if (!jobInfo) {
    const gob = await GetOnBrd()
    jobInfo = await gob.getJob(jobUrl)
    await redis.hsetJson(CACHE_JOBS_MAP_KEY, jobUrl, jobInfo)
  }

  const companyExists = await redis.hexists(
    CACHE_COMPANIES_KEY,
    jobInfo.company.url
  )

  if (!companyExists) {
    sendToQueue(ch)(QUEUE_GET_COMPANIES, jobInfo.company.url)
  }

  await ch.ack(msg)
}
