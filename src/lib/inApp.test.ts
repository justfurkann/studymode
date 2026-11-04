import { describe, expect, it } from 'vitest'
import { chromeIntent, detectInApp } from './inApp'

const IG_ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-A256E Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0 Mobile Safari/537.36 Instagram 360.0.0.40.92 Android'
const IG_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 360.0.0.40.92 (iPhone15,2; iOS 18_0)'
const WV = 'Mozilla/5.0 (Linux; Android 12; SM-A217F Build/SP1A.210812.016; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0 Mobile Safari/537.36'
const CHROME = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Mobile Safari/537.36'
const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'

describe('in-app browsers', () => {
  it('knows Instagram on both phones, other web views on Android, and leaves real browsers alone', () => {
    expect(detectInApp(IG_ANDROID)).toEqual({ app: 'Instagram', platform: 'android' })
    expect(detectInApp(IG_IOS)).toEqual({ app: 'Instagram', platform: 'ios' })
    expect(detectInApp(WV)).toEqual({ app: '', platform: 'android' })
    expect(detectInApp(CHROME)).toBeNull()
    expect(detectInApp(SAFARI)).toBeNull()
  })

  it('builds a Chrome intent that keeps the path and falls back to the page itself', () => {
    expect(chromeIntent('https://studymode.fun/kod#SM-AB2C-DE3F-GH4J')).toBe(
      'intent://studymode.fun/kod#SM-AB2C-DE3F-GH4J#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fstudymode.fun%2Fkod%23SM-AB2C-DE3F-GH4J;end',
    )
  })
})
