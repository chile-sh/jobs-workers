import commonConfig from '@common/config'

const { GETONBRD_SESSION } = process.env

export default {
  ...commonConfig,

  bots: {
    getonbrd: {
      session: GETONBRD_SESSION,
      cron: '0 18,23 * * *',
      runOnInit: true
    }
  }
}
