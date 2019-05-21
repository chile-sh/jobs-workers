import _ from 'lodash'
import { DeepPartialGraphModel } from 'objection'

import { first } from '@common/lib/db'
import { defaultClient as redis } from '@common/lib/redis'
import { logger } from '@common/lib/logger'

import {
  CACHE_SALARIES_MAP_KEY,
  CACHE_COMPANIES_KEY,
  CACHE_JOBS_MAP_KEY,
  SOURCE_NAME
} from '../constants'

import Job from '@common/models/Job'
import Country from '@common/models/Country'
import City from '@common/models/City'
import Company from '@common/models/Company'
import Category from '@common/models/Category'
import Tag from '@common/models/Tag'

const TASK_NAME = `${SOURCE_NAME}.insert-data`

const getSlug = (url: string) => {
  const splitUrl: any[] = url.split('/')
  return splitUrl[splitUrl.length - 1]
}

export const run = async (onProgress?: Function) =>
  new Promise(resolve => {
    logger.info(`${TASK_NAME}: inserting records into database...`)
    const stream: any = redis.hscanStream(CACHE_JOBS_MAP_KEY)

    stream.on('data', async (resultKeys: string[]) => {
      // Pause the stream from scanning more keys until we've migrated the current keys.
      stream.pause()

      const jobs = _.chunk(resultKeys, 2)
        .map(([url, jobInfo]) => jobInfo && { url, ...JSON.parse(jobInfo) })
        .filter(Boolean)

      // Cache tags instead of querying the db on each item
      const tags = new Map()
      const tagsFromDb = await Tag.query().select()

      tagsFromDb.forEach(({ id, name }) => tags.set(name, { id, name }))

      for (const tag of _.flatten(jobs.map(job => job.tags))) {
        if (!tags.get(tag)) {
          const newTag = await Tag.query().insert({ name: tag })
          tags.set(tag, { id: newTag.id, name: tag })
        }
      }

      const graphs: DeepPartialGraphModel<Job>[] = []

      for (const job of jobs) {
        const company = await redis.hgetJson(
          CACHE_COMPANIES_KEY,
          job.company.url
        )
        const salary = await redis.hgetJson(CACHE_SALARIES_MAP_KEY, job.url)

        const [salaryFrom, salaryTo]: any = salary || []

        const jobSlug = getSlug(job.url)
        const companySlug = getSlug(job.company.url)

        // TODO: refactor and cache the same way as tags
        const _country = await first(Country, { name: job.country })
        const _city =
          _country &&
          (await first(City, { name: job.city, countryId: _country.id }))
        const _company = await first(Company, { slug: companySlug })
        const _category = await first(Category, { slug: job.category.slug })
        const _job = await first(Job, { slug: jobSlug })

        const salariesHistory = _job ? _job.salariesHistory || [] : []

        const currSalary = { date: new Date(), range: [salaryFrom, salaryTo] }
        const salaryDidChange =
          _job &&
          (+_job.salaryFrom !== +salaryFrom || +_job.salaryTo !== +salaryTo)

        const graph: DeepPartialGraphModel<Job> = {
          id: _job ? _job.id : undefined,
          category: {
            id: _category ? _category.id : undefined,
            ...job.category
          },
          publishedAt: job.parsedDate,
          description: job.description,
          level: job.level,
          title: job.title,
          type: job.type,
          version: 1,
          slug: jobSlug,
          meta: JSON.stringify({
            originalUrl: job.url,
            trending: job.trending
          }),
          city: job.city
            ? {
                id: _city ? _city.id : undefined,
                name: job.city,
                country: {
                  id: _country ? _country.id : undefined,
                  name: job.country
                }
              }
            : undefined,
          salaryFrom,
          salaryTo,
          salariesHistory: JSON.stringify(
            job.salary && salaryDidChange
              ? [...salariesHistory, currSalary]
              : !_job
              ? [currSalary]
              : salariesHistory
          ),
          tags: job.tags.map(tag => tags.get(tag)),
          company: {
            id: _company ? _company.id : undefined,
            description: company.about,
            slug: companySlug,
            shortDescription: company.subtitle,
            name: job.company.name,
            logo: null,
            meta: JSON.stringify({
              originalUrl: job.company.url,
              originalLogo: company.logo,
              links: company.links,
              followers: company.followers
            })
          }
        }

        graphs.push(graph)
      }

      const insertedItems = await Job.query().upsertGraph(graphs, {
        relate: true,
        unrelate: true
      })

      onProgress && onProgress(insertedItems)

      stream.resume()
    })

    stream.on('end', function() {
      logger.info(`${TASK_NAME}: done!`)
      resolve(TASK_NAME)
    })
  })
