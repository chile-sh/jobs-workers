import { parentPort } from 'worker_threads'
import { run as runGetonbrdTask } from '@/components/getonbrd'

runGetonbrdTask((msg: any) => parentPort.postMessage(msg), () => process.exit())
