import { CronJob, CronCommand } from 'cron'
import { logger } from '@common/lib/logger'

import * as bots from '@/components/bots'

import config from '@/config'
import '@common/lib/sentry'

const initCronJob = (bot: any, callback: CronCommand) =>
  new CronJob(bot.cron, callback, null, true, config.tz, null, bot.runOnInit)

for (const [name, botConfig] of Object.entries(config.bots)) {
  initCronJob(botConfig, () =>
    bots[name].runAllTasks(
      (taskName: string, info: any) => {
        const prefix = `${name}.${taskName}`

        switch (taskName) {
          case 'insert-data':
            logger.info(`${prefix}: ${info.slug}`)
            break
          default:
            logger.info(`${prefix}: ${JSON.stringify(info)}`)
        }
      },
      (taskName: string) => logger.info(`${name}.${taskName}: done!`)
    )
  )
}
