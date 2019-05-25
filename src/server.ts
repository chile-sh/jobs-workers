import { CronJob, CronCommand } from 'cron'
import { logger } from '@common/lib/logger'

import * as bots from '@/components/bots'

import config from '@/config'
import '@common/lib/sentry'

const TIMEZONE = 'America/Santiago'

const initCronJob = (bot: any, callback: CronCommand) =>
  new CronJob(bot.cron, callback, null, true, TIMEZONE, null, bot.runOnInit)

for (const [name, botConfig] of Object.entries(config.bots)) {
  initCronJob(botConfig, () =>
    bots[name].runAllTasks((taskName: string, info: any) => {
      logger.info(`${taskName}: ${JSON.stringify(info)}`)
    })
  )
}
