import pMap from 'p-map'
import db from '@common/lib/db'
import request from '@common/lib/request'

import Asset from '@common/models/Asset'
import Company from '@common/models/Company'

import { upload } from '@common/lib/storage'
import { SCHEMA } from '@common/constants'
import { logger } from '@common/lib/logger'

import { SOURCE_NAME } from '../constants'
import config from '@/config'

export const TASK_NAME = `${SOURCE_NAME}.get-assets`

export const run = async (onProgress?: Function) => {
  const withoutLogo = await db
    .table(SCHEMA.companies.__tableName)
    .select(['id', SCHEMA.companies.meta, SCHEMA.companies.slug])
    .where({ logo: null })

  await pMap(
    withoutLogo,
    async (company: any) => {
      const { originalLogo } = company.meta
      if (!originalLogo) return

      const urlArr: string[] = originalLogo.split('.')
      const ext = urlArr[urlArr.length - 1]

      const { body } = await request(company.meta.originalLogo, {
        encoding: null
      })

      const filename = `${company.slug}.${ext}`
      const path = `logos/${filename}`
      const mimetype = `image/${ext}`

      const uploaded = await upload(body, path, undefined, {
        ContentType: mimetype
      })

      const { id: assetId } = await Asset.query().insert({
        filename,
        path,
        mimetype
      })

      await Company.query().upsertGraph({ id: company.id, logo: assetId })

      logger.info(
        `${TASK_NAME}: asset ${path} uploaded to bucket ${config.aws.s3.bucket}`
      )

      onProgress && onProgress({ uploaded, path })
    },
    { concurrency: 10 }
  )

  logger.info(`${TASK_NAME}: done!`)
}
