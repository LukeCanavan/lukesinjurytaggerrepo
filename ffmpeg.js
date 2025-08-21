import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs'
import path from 'path'

export async function extractClips({ source, events, pre=2, post=2, outDir }) {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  const tasks = events.map((e, i) => new Promise((resolve, reject) => {
    const start = Math.max(0, Number(e.timestamp_s) - pre)
    const duration = pre + post
    const safeLabel = (e.label||'event').replace(/\W+/g,'_')
    const out = path.join(outDir, `${String(i).padStart(4,'0')}_${start.toFixed(2)}s_${safeLabel}.mp4`)
    ffmpeg(source)
      .setStartTime(start)
      .setDuration(duration)
      .output(out)
      .on('end', () => resolve(out))
      .on('error', reject)
      .run()
  }))
  return Promise.all(tasks)
}
