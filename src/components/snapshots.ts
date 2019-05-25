import { transaction } from 'objection'

import { SCHEMA } from '@common/constants'
import Snapshot from '@common/models/Snapshot'
import Source from '@common/models/Source'

const { snapshots, sources } = SCHEMA

export const getLatest = (slug: string) =>
  Snapshot.query()
    .joinEager('source')
    .where(snapshots.current, true)
    .where(`source.${sources.slug}`, slug)
    .orderBy(snapshots.version, 'desc')
    .first()

export const create = async (slug: string) => {
  const latest = await getLatest(slug)
  let source = latest && latest.source

  if (!latest) {
    source = await Source.query()
      .where({ slug })
      .first()

    if (!source) throw Error(`Couldn't find source ${slug}`)
  }

  const version: number = latest ? latest.version + 1 : 1

  return Snapshot.query().insertGraph(
    { source, version, processStartedAt: new Date() },
    { relate: true }
  )
}

export const setSnapshot = async (snapshotId: number, slug: string) =>
  transaction(Snapshot.knex(), async trx => {
    const latest = await getLatest(slug)
    if (!latest) throw Error(`Couldn't set snapshot for source ${slug}`)

    await Snapshot.query(trx)
      .update({ current: false })
      .where({ id: latest.id })

    return Snapshot.query(trx).upsertGraph({
      id: snapshotId,
      processFinishedAt: new Date(),
      current: true
    })
  })
