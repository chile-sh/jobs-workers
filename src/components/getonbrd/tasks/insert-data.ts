import _ from 'lodash'
import { DeepPartialGraphModel } from 'objection'

import db, { first } from '@common/lib/db'
import { logger } from '@common/lib/logger'
import { SCHEMA } from '@common/constants'

import Job from '@common/models/Job'
import Country from '@common/models/Country'
import City from '@common/models/City'
import Company from '@common/models/Company'
import Category from '@common/models/Category'
import Tag from '@common/models/Tag'
import Source from '@chile-sh/jobs-common/build/models/Source'

import {
  CACHE_COMPANIES_KEY,
  CACHE_JOBS_MAP_KEY,
  SOURCE_NAME,
  SOURCE_ID,
  SALARY_STEP,
  CACHE_SALARY_MAP_KEY,
  CACHE_SNAPSHOT_KEY
} from '../constants'

import { redisClients } from '../helpers'

const { db0: redis } = redisClients

export const TASK_NAME = 'insert-data'

const getSlug = (url: string) => {
  const splitUrl: any[] = url.split('/')
  return splitUrl[splitUrl.length - 1]
}

const createMap = (items: any[], keyName = 'name'): Map<string, any> => {
  const map = new Map()
  items.forEach(item => map.set(item[keyName], item))
  return map
}

const minMax = (arr: number[]) => [_.min(arr), _.max(arr)]

export const run = async (onProgress?: Function) =>
  new Promise(async resolve => {
    let streamEnded = false

    logger.debug(
      `${SOURCE_NAME}.${TASK_NAME}: inserting records into database...`
    )

    const snapshot = await redis.getJson(CACHE_SNAPSHOT_KEY)
    const stream: any = redis.hscanStream(CACHE_JOBS_MAP_KEY)

    stream.on('data', async (resultKeys: string[]) => {
      // Pause the stream from scanning more keys until we've migrated the current keys.
      stream.pause()

      const jobs = _.chunk(resultKeys, 2)
        .map(([url, jobInfo]) => jobInfo && { url, ...JSON.parse(jobInfo) })
        .filter(Boolean)

      // Populate from database
      const [dbTags, dbCities, dbCountries] = await Promise.all(
        [Tag, City, Country].map((model: any) => model.query().select())
      )

      const maps = {
        tags: createMap(dbTags),
        cities: createMap(dbCities),
        countries: createMap(dbCountries)
      }

      for (const job of jobs) {
        const jobSlug = getSlug(job.url)
        const companySlug = getSlug(job.company.url)

        const _job = await first(Job, { slug: jobSlug })

        const common: { id; slug; source: Partial<Source> } = {
          id: _job ? _job.id : undefined,
          slug: jobSlug,
          source: { id: SOURCE_ID }
        }

        if (job.isClosed) {
          await Job.query().upsertGraph({ ...common, isClosed: true })
          continue
        }

        const _company = await first(Company, { slug: companySlug })
        const _category = await first(Category, { slug: job.category.slug })

        const { city, country: countryName, tags } = job

        // Insert Tags
        for (const tag of tags) {
          if (!maps.tags.get(tag)) {
            const [id] = await db
              .table(SCHEMA.tags.__tableName)
              .insert({
                [SCHEMA.tags.name]: tag
              })
              .returning('id')
            maps.tags.set(tag, { id, name: tag })
          }
        }

        // Insert Countries
        if (countryName && !maps.countries.get(countryName)) {
          const name = countryName
          const [id] = await db
            .table(SCHEMA.countries.__tableName)
            .insert({ [SCHEMA.countries.name]: name })
            .returning('id')
          maps.countries.set(name, { id, name })
        }

        // Insert Cities
        if (city && !maps.cities.get(city)) {
          const { id: countryId } = maps.countries.get(countryName)
          const [id] = await db
            .table(SCHEMA.cities.__tableName)
            .insert({
              [SCHEMA.cities.name]: city,
              [SCHEMA.cities.countryId]: countryId
            })
            .returning('id')
          maps.cities.set(city, { id, name: city })
        }

        const company = await redis.hgetJson(
          CACHE_COMPANIES_KEY,
          job.company.url
        )

        const _salary = (await redisClients.db1.smembers(
          `${CACHE_SALARY_MAP_KEY}:${job.url}`
        )).map(Number)

        // If the salary is available, we grab it from the job description
        // If the salary is fixed (it isn't range), the array will be filled
        // with its value.
        // For every other job, it will get the salary from redis

        const salary = job.salary || (_salary.length && minMax(_salary)) || []
        const [salaryFrom, salaryTo] = [salary[0], salary[1] || salary[0]]

        const salariesHistory = _job ? _job.salariesHistory || [] : []

        const currSalary = { date: new Date(), range: [salaryFrom, salaryTo] }
        const salaryDidChange =
          _job &&
          (+_job.salaryFrom !== +salaryFrom || +_job.salaryTo !== +salaryTo)
        const salaryFromMap = !Boolean(job.salary)

        const graph: DeepPartialGraphModel<Job> = {
          ...common,
          category: {
            id: _category ? _category.id : undefined,
            ...job.category
          },
          publishedAt: job.parsedDate,
          description: job.description,
          level: job.level,
          title: job.title,
          type: job.type,
          version: snapshot ? snapshot.version : 1,
          slug: jobSlug,
          meta: JSON.stringify({
            originalUrl: job.url,
            trending: job.trending
          }),
          city: maps.cities.get(job.city)
            ? {
                ...maps.cities.get(job.city),
                country: maps.countries.get(job.country)
              }
            : undefined,
          salaryFrom,

          // We need to substract the difference, since getonbrd will return
          // jobs that are in the 0-${SALARY_STEP} USD range.
          salaryTo:
            salaryFromMap && salaryTo ? salaryTo - SALARY_STEP : salaryTo,
          salaryFromMap,
          salariesHistory: JSON.stringify(
            salary && salaryDidChange
              ? [...salariesHistory, currSalary]
              : !_job
              ? [currSalary]
              : salariesHistory
          ),
          tags: job.tags.map(tag => maps.tags.get(tag)),
          company: {
            id: _company ? _company.id : undefined,
            description: company.about,
            slug: companySlug,
            shortDescription: company.subtitle,
            name: job.company.name,
            meta: JSON.stringify({
              originalUrl: job.company.url,
              originalLogo: company.logo,
              links: company.links,
              followers: company.followers
            })
          }
        }

        await Job.query().upsertGraph(graph, {
          relate: true,
          unrelate: true
        })

        onProgress && onProgress(graph)
      }

      if (streamEnded) {
        return resolve(TASK_NAME)
      }

      stream.resume()
    })

    stream.on('end', () => {
      streamEnded = true
    })
  })
