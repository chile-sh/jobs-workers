import { SOURCES } from '@common/constants'

export const SOURCE_NAME = SOURCES.getonbrd.slug
export const SOURCE_ID = SOURCES.getonbrd.id

export const SALARY_STEP = 50
export const SALARY_RANGE = [0, 20000]

export const CACHE_CONFIG_KEY = `${SOURCE_NAME}.config`
export const CACHE_CSFR_KEY = `${SOURCE_NAME}.csfr`
export const CACHE_SESSION_KEY = `${SOURCE_NAME}.session`
export const CACHE_COMPANIES_KEY = `${SOURCE_NAME}.companies`
export const CACHE_JOBS_MAP_KEY = `${SOURCE_NAME}.jobs`
export const CACHE_JOBS_QUEUED_KEY = `${SOURCE_NAME}.jobs.queued`
export const CACHE_SALARY_RANGE_KEY = `${SOURCE_NAME}.salaryRanges`

export const QUEUE_GET_JOBS = `${SOURCE_NAME}.getJobs`
export const QUEUE_GET_SALARIES = `${SOURCE_NAME}.getSalaries`
export const QUEUE_GET_COMPANIES = `${SOURCE_NAME}.getCompanies`

export const CONFIG_MAX_PREFETCH = 8
