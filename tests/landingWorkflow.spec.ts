import { expect, test } from '@playwright/test'

test('the landing animation follows the system theme and the current highlighter, and can replay', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' })
  await page.goto('/')

  const scene = page.getByRole('img', { name: /^Öğrenme ve bellek notunun/ })
  const panel = scene.locator('.lp-workflow-panel')
  const output = scene.locator('.lp-workflow-output').last()
  await expect(panel).toHaveCSS('fill', 'rgb(242, 242, 235)')
  await expect(output).toHaveCSS('opacity', '1', { timeout: 8_000 })

  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(panel).toHaveCSS('fill', 'rgb(35, 40, 71)')
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'light'
    document.documentElement.dataset.pen = 'nane'
  })
  await expect(panel).toHaveCSS('fill', 'rgb(242, 242, 235)')
  await expect(scene.locator('.lp-workflow-highlight').first()).toHaveCSS('fill', 'rgb(127, 240, 184)')

  await page.getByRole('button', { name: 'Animasyonu tekrar oynat' }).click()
  await expect(output).toHaveCSS('opacity', '0')
})

test('the static study set stays readable on mobile with reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  await page.goto('/tanitim')

  const scene = page.getByRole('img', { name: /^Öğrenme ve bellek notunun/ })
  await scene.scrollIntoViewIfNeeded()
  await expect(scene.locator('.lp-workflow-output').last()).toHaveCSS('opacity', '1')
  await expect(scene.locator('.lp-workflow-status-ready')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Animasyonu tekrar oynat' })).toBeHidden()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
})
