import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function chooseOption(page: Page, label: string, option: string) {
  await page.getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

async function navigate(page: Page, label: string) {
  await expect(page.getByRole('banner')).toBeVisible();
  const menu = page.getByRole('button', { name: 'Open navigation' });
  if (await menu.isVisible()) await menu.click();
  await page
    .getByRole('navigation', { name: 'Workspace navigation', exact: true })
    .getByRole('link', { name: label, exact: true })
    .click();
}

test('mobile bottom destinations and shared drawer fit phones and tablets', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Responsive mobile coverage');
  for (const width of [320, 390, 768, 1100]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/listings');
    const bottom = page.getByRole('navigation', { name: 'Frequent destinations' });
    await expect(bottom).toBeVisible();
    await expect(bottom.getByRole('link')).toHaveCount(4);
    await expect(bottom.getByRole('link', { name: 'Listings', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    const bounds = await bottom.boundingBox();
    const contentBounds = await page.getByRole('main').boundingBox();
    expect(Math.round(bounds!.y + bounds!.height)).toBe(844);
    expect(contentBounds!.y + contentBounds!.height).toBeLessThanOrEqual(bounds!.y);
    for (const target of await bottom.locator('a,button').all()) {
      const targetBounds = await target.boundingBox();
      expect(targetBounds!.width).toBeGreaterThanOrEqual(44);
      expect(targetBounds!.height).toBeGreaterThanOrEqual(44);
    }
    const menu = bottom.getByRole('button', { name: 'Menu', exact: true });
    await menu.click();
    const drawer = page.getByRole('dialog');
    await expect(drawer).toHaveCount(1);
    await expect(
      drawer
        .getByRole('navigation', { name: 'Workspace navigation', exact: true })
        .getByRole('link'),
    ).toHaveCount(5);
    await page.keyboard.press('Escape');
    await expect(menu).toBeFocused();
    await menu.click();
    await drawer.getByRole('link', { name: 'Dialogs and panels', exact: true }).click();
    await expect(drawer).toHaveCount(0);
    await expect(page.getByRole('main')).toBeFocused();
    await expect(bottom.locator('[aria-current="page"]')).toHaveCount(0);
    await bottom.getByRole('link', { name: 'Controls', exact: true }).click();
    await expect(page).toHaveURL(/\/controls$/);
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Open navigation', exact: true })).toBeFocused();
    await chooseOption(page, 'Language', 'Spanish');
    await expect(page.getByRole('navigation', { name: 'Destinos frecuentes' })).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= innerWidth &&
          document.documentElement.scrollHeight <= innerHeight,
      ),
    ).toBe(true);
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await expect(page).toHaveScreenshot(`bottom-navigation-${width}.png`, {
      animations: 'disabled',
    });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator('.noa-bottom-navigation')).toBeHidden();
  await expect(page.getByRole('complementary')).toBeVisible();
});

test('shared shell persists through navigation and supports direct routes and history', async ({
  page,
}, testInfo) => {
  await page.goto('/data');
  await expect(page.getByRole('heading', { name: 'Data views', level: 1 })).toBeVisible();
  const main = await page.getByRole('main').elementHandle();
  const mobile = testInfo.project.name === 'mobile';
  if (!mobile) await page.getByRole('button', { name: 'Collapse menu', exact: true }).click();
  if (mobile) {
    const trigger = page.getByRole('button', { name: 'Open navigation' });
    await trigger.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
  }
  await navigate(page, 'Dialogs and panels');
  await expect(page).toHaveURL(/\/overlays$/);
  await expect(page.getByRole('main')).toBeFocused();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  if (!mobile)
    await expect(page.getByRole('button', { name: 'Expand menu', exact: true })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  expect(await main!.evaluate((element) => element === document.querySelector('main'))).toBe(true);
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Data views', level: 1 })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('heading', { name: 'Dialogs and panels', level: 1 })).toBeVisible();
  await expect(page.getByRole('banner')).toHaveCount(1);
  await expect(page.getByRole('main')).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Dialogs and panels', level: 1 })).toBeVisible();
});

test('Noatum workspace layout, focus, Spanish and accessibility', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Controls', level: 1 })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCSS(
    'background-color',
    'rgb(170, 39, 47)',
  );
  await expect(page.locator('body')).toHaveCSS('font-family', /Mulish/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await expect(page).toHaveScreenshot('controls.png', { fullPage: true, animations: 'disabled' });
  await navigate(page, 'Dialogs and panels');
  const trigger = page.getByRole('button', { name: 'Open dialog', exact: true });
  await trigger.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await page.getByRole('button', { name: 'Open panel', exact: true }).click();
  await expect(page).toHaveScreenshot('panel.png', { fullPage: true, animations: 'disabled' });
  await page.keyboard.press('Escape');
  await navigate(page, 'Data views');
  await page.getByRole('searchbox').fill('checkbox');
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(2);
  await chooseOption(page, 'Language', 'Spanish');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es-ES');
  await page.getByRole('searchbox').fill('');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await expect(page).toHaveScreenshot('data-spanish.png', {
    fullPage: true,
    animations: 'disabled',
  });
  expect(errors).toEqual([]);
  await testInfo.attach('runtime-errors', {
    body: JSON.stringify(errors),
    contentType: 'application/json',
  });
});

test('listing pagination and right filter drawer match the reusable pattern', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await navigate(page, 'Listings and filters');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByText('Showing 1\u20138 of 16')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(
    true,
  );
  await expect(page).toHaveScreenshot('listing.png', { fullPage: true, animations: 'disabled' });
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.getByRole('button', { name: 'Last page', exact: true }).click();
  await expect(page.getByText('Page 2 of 2')).toBeVisible();
  await chooseOption(page, 'Rows per page', '16');
  await expect(page.getByText('Showing 1\u201316 of 16')).toBeVisible();
  await chooseOption(page, 'Rows per page', '8');
  const trigger = page.getByRole('button', { name: /^Filters(?:\s+\d+)?$/ });
  await trigger.click();
  const drawer = page.getByRole('dialog', { name: 'Filters', exact: true });
  await expect(drawer).toBeVisible();
  const bounds = await drawer.boundingBox();
  expect(Math.round(bounds!.x + bounds!.width)).toBe(page.viewportSize()!.width);
  await expect(page).toHaveScreenshot('listing-filters.png', {
    fullPage: true,
    animations: 'disabled',
  });
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.getByRole('checkbox', { name: 'Air', exact: true }).click();
  await page.getByRole('button', { name: 'Show 4 results' }).click();
  await expect(trigger).toBeFocused();
  await expect(page.getByText('Showing 1\u20134 of 4')).toBeVisible();
  await page.getByRole('button', { name: 'Cards', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(4);
  await chooseOption(page, 'Language', 'Spanish');
  await expect(page).toHaveScreenshot('listing-cards-spanish.png', {
    fullPage: true,
    animations: 'disabled',
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  expect(errors).toEqual([]);
});
