import { createQueue } from '@common/lib/amqplib'
import { onError } from '../helpers'

import getSalariesCb from './get-salaries'
import getCompaniesCb from './get-companies'
import getJobsCb from './get-jobs'

import {
  QUEUE_GET_JOBS,
  QUEUE_GET_SALARIES,
  QUEUE_GET_COMPANIES
} from '../constants'

export const makeQueues = async (ch?: any) => ({
  getSalaries: {
    name: QUEUE_GET_SALARIES,
    run: () => createQueue(ch)(QUEUE_GET_SALARIES, {}, getSalariesCb, onError)
  },
  getJobs: {
    name: QUEUE_GET_JOBS,
    run: () =>
      createQueue(ch)(
        QUEUE_GET_JOBS,
        { assert: [QUEUE_GET_SALARIES] },
        getJobsCb,
        onError
      )
  },
  getCompany: {
    name: QUEUE_GET_COMPANIES,
    run: () =>
      createQueue(ch)(
        QUEUE_GET_COMPANIES,
        { assert: [QUEUE_GET_JOBS] },
        getCompaniesCb,
        onError
      )
  }
})
