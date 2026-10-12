import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import i18n from '@/i18n';
import english from '@/i18n/en-US.json';
import spanish from '@/i18n/es-ES.json';
import Workspace from '@/app/App';

const restoreBrowserMethods: (() => void)[] = [];

function stubElementMethod(name: string, value: unknown) {
  const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, name);
  if (descriptor) return;
  Object.defineProperty(Element.prototype, name, { configurable: true, value });
  restoreBrowserMethods.push(() => Reflect.deleteProperty(Element.prototype, name));
}

function checkCssReferences(css: string) {
  const runtimeVariables = new Set(['--radix-select-content-available-height']);
  const definitions = Object.fromEntries(
    [...css.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((match) => [match[1]!, match[2]!]),
  );
  const check = (name: string, ancestors: string[] = []) => {
    if (runtimeVariables.has(name) && definitions[name] === undefined) return;
    expect(definitions[name], name).toBeDefined();
    expect(ancestors, name).not.toContain(name);
    for (const reference of definitions[name]!.matchAll(/var\((--[\w-]+)/g))
      check(reference[1]!, [...ancestors, name]);
  };
  for (const reference of css.matchAll(/var\((--[\w-]+)/g)) check(reference[1]!);
}

async function chooseOption(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  option: string,
) {
  await user.click(screen.getByRole('combobox', { name: label }));
  await user.click(screen.getByRole('option', { name: option }));
}

beforeEach(async () => {
  window.history.replaceState(null, '', '/');
  const capturedPointers = new WeakMap<Element, Set<number>>();
  stubElementMethod('hasPointerCapture', function (this: Element, pointerId: number) {
    return capturedPointers.get(this)?.has(pointerId) ?? false;
  });
  stubElementMethod('setPointerCapture', function (this: Element, pointerId: number) {
    const pointers = capturedPointers.get(this) ?? new Set<number>();
    pointers.add(pointerId);
    capturedPointers.set(this, pointers);
  });
  stubElementMethod('releasePointerCapture', function (this: Element, pointerId: number) {
    capturedPointers.get(this)?.delete(pointerId);
  });
  stubElementMethod('scrollIntoView', vi.fn());
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    },
  );
  await i18n.changeLanguage('en-US');
});
afterEach(() => {
  cleanup();
  restoreBrowserMethods.splice(0).forEach((restore) => restore());
  vi.unstubAllGlobals();
});

describe('Noatum foundation', () => {
  it('preserves the shared shell and collapsed sidebar across child routes', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/data');
    render(<Workspace />);
    const main = screen.getByRole('main');
    const header = screen.getByRole('banner');
    expect(screen.getByRole('heading', { name: 'Data views', level: 1 })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Collapse menu' }));
    const destination = screen.getByRole('link', { name: 'Dialogs and panels' });
    expect(destination).toHaveAttribute('href', '/overlays');
    await user.click(destination);
    expect(window.location.pathname).toBe('/overlays');
    expect(destination).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Expand menu' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByRole('main')).toBe(main);
    expect(screen.getByRole('banner')).toBe(header);
    expect(main).toHaveFocus();
  });

  it('keeps every translation present and nonempty in both languages', () => {
    expect(Object.keys(spanish).sort()).toEqual(Object.keys(english).sort());
    expect(Object.values(spanish).every((value) => value.trim())).toBe(true);
  });

  it('matches canonical tokens and keeps all stylesheet aliases resolvable without cycles', () => {
    const folder = resolve('src/design-system');
    const tokenSource = readFileSync(resolve(folder, 'styles/tokens.css'), 'utf8');
    const canonical =
      readFileSync(resolve('../../docs/noatum-designsystem.md'), 'utf8').match(
        /```css\s*([\s\S]*?)```/,
      )?.[1] ?? '';
    const declarations = (source: string) =>
      [...source.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(
        (match) => [match[1]!, match[2]!.replace(/\s+/g, '')] as const,
      );
    expect(canonical).not.toBe('');
    const tokens = Object.fromEntries(declarations(tokenSource));
    const normalizeValue = (value: string) =>
      value
        .replace(/#[\da-f]+/gi, (color) => color.toLowerCase())
        .replace(/\b\d+\.\d+\b/g, (number) => String(Number(number)));
    for (const [name, value] of declarations(canonical)) {
      expect(normalizeValue(tokens[name] ?? ''), name).toBe(normalizeValue(value));
    }
    const css = readdirSync(folder, { recursive: true, encoding: 'utf8' })
      .filter((path) => path.endsWith('.css'))
      .map((path) => readFileSync(resolve(folder, path), 'utf8'))
      .join('\n');
    checkCssReferences(css);
    expect(tokenSource).not.toContain('prefers-color-scheme');
  });

  it('accepts the Radix-owned runtime dimension through a local alias', () => {
    expect(() =>
      checkCssReferences(
        ':root { --select-height: var(--radix-select-content-available-height); } .select { max-height: var(--select-height); }',
      ),
    ).not.toThrow();
  });

  it.each([
    ['missing Noatum token', '.select { color: var(--color-unknown); }'],
    ['misspelled Radix variable', '.select { height: var(--radix-select-unknown); }'],
    ['cyclic aliases', ':root { --first: var(--second); --second: var(--first); }'],
    ['missing alias dependency', ':root { --select-height: var(--missing-height); }'],
  ])('rejects %s', (_description, css) => {
    expect(() => checkCssReferences(css)).toThrow();
  });

  it('validates the demo field, disables pending actions and resets the controls', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/controls');
    render(<Workspace />);
    expect(screen.getByRole('button', { name: 'Saving' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a label.');
    await user.type(screen.getByLabelText(/Label/), 'Example label');
    await user.click(screen.getByRole('checkbox', { name: 'Selected' }));
    expect(screen.getByRole('checkbox')).toBeChecked();
    await user.click(screen.getByRole('switch'));
    expect(screen.getByRole('switch')).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Preview changes saved.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByLabelText(/Label/)).toHaveValue('');
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(screen.getByRole('switch')).toBeChecked();
  });

  it('supports modal escape, focus restoration and keyboard tabs', async () => {
    const user = userEvent.setup();
    render(<Workspace />);
    await user.click(screen.getByRole('link', { name: 'Dialogs and panels' }));
    const trigger = screen.getByRole('button', { name: 'Open dialog' });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Display preferences' });
    await user.click(within(dialog).getByRole('tab', { name: 'Appearance' }));
    await user.keyboard('{ArrowRight}');
    expect(within(dialog).getByRole('tab', { name: 'Details' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Open panel' }));
    expect(screen.getByRole('dialog')).toHaveClass('noa-sheet-right');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('filters, sorts and pages the finite component sample and exposes all data states', async () => {
    const user = userEvent.setup();
    render(<Workspace />);
    await user.click(
      within(screen.getByRole('navigation', { name: 'Workspace navigation' })).getByRole('link', {
        name: 'Data views',
      }),
    );
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByText('Page 2 of 3')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Component' }));
    expect(screen.getByRole('columnheader', { name: 'Component' })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    await user.type(screen.getByRole('searchbox'), 'checkbox');
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2);
    await user.clear(screen.getByRole('searchbox'));
    await user.type(screen.getByRole('searchbox'), 'missing');
    expect(screen.getByText('No components found')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await chooseOption(user, 'View state', 'Error');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByRole('table')).toBeVisible();
    await chooseOption(user, 'View state', 'Loading');
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    await chooseOption(user, 'View state', 'Empty');
    expect(screen.getByText('No components found')).toBeVisible();
  });

  it('switches the workspace and document language to Spanish', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/controls');
    render(<Workspace />);
    await chooseOption(user, 'Language', english.spanish);
    expect(await screen.findByRole('heading', { name: 'Controles', level: 1 })).toBeVisible();
    expect(document.documentElement).toHaveAttribute('lang', 'es-ES');
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeVisible();
  });

  it('coordinates listing tabs, page size, sorting, search and cards', async () => {
    const user = userEvent.setup();
    render(<Workspace />);
    await user.click(
      within(screen.getByRole('navigation', { name: 'Workspace navigation' })).getByRole('link', {
        name: 'Listings and filters',
      }),
    );
    expect(screen.getByText('Showing 1\u20138 of 16')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Last page' }));
    expect(screen.getByText('Page 2 of 2')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
    await chooseOption(user, 'Rows per page', '16');
    expect(screen.getByText('Showing 1\u201316 of 16')).toBeVisible();
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(17);
    await user.click(screen.getByRole('button', { name: 'ETA' }));
    expect(screen.getByRole('columnheader', { name: 'ETA' })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    await user.click(screen.getByRole('tab', { name: 'Delivered 4' }));
    expect(screen.getByText('Showing 1\u20134 of 4')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Cards' }));
    expect(screen.getAllByRole('article')).toHaveLength(4);
    await user.type(screen.getByRole('searchbox'), 'DEMO-H1');
    expect(screen.getAllByRole('article')).toHaveLength(1);
    await user.clear(screen.getByRole('searchbox'));
    await user.type(screen.getByRole('searchbox'), 'unmatched');
    expect(screen.getByText('No matching records')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getAllByRole('article')).toHaveLength(16);
  });

  it('applies multi-select filters only on confirmation and restores a saved preview view', async () => {
    const user = userEvent.setup();
    render(<Workspace />);
    await user.click(
      within(screen.getByRole('navigation', { name: 'Workspace navigation' })).getByRole('link', {
        name: 'Listings and filters',
      }),
    );
    const trigger = screen.getByRole('button', { name: 'Filters' });
    await user.click(trigger);
    expect(screen.getByRole('dialog')).toHaveClass('noa-sheet-right');
    await user.click(screen.getByRole('checkbox', { name: 'Air' }));
    expect(screen.getByRole('button', { name: 'Show 4 results' })).toBeEnabled();
    await user.keyboard('{Escape}');
    expect(trigger).toHaveFocus();
    expect(screen.getByText('Showing 1\u20138 of 16')).toBeVisible();
    await user.click(trigger);
    expect(screen.getByRole('checkbox', { name: 'Air' })).not.toBeChecked();
    await user.click(screen.getByRole('checkbox', { name: 'Air' }));
    await user.click(screen.getByRole('checkbox', { name: 'Road' }));
    await user.click(screen.getByRole('button', { name: 'Show 5 results' }));
    expect(screen.getByText('Showing 1\u20135 of 5')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Remove filter: Road' }));
    expect(screen.getByText('Showing 1\u20134 of 4')).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Filters/ }));
    await user.click(screen.getByRole('button', { name: 'Save as view' }));
    expect(screen.getByText('View saved for this preview session.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Clear all' }));
    await chooseOption(user, 'Saved views', i18n.t('savedViewName', { number: '1' }));
    expect(screen.getByText('Showing 1\u20134 of 4')).toBeVisible();
  });

  it('validates date ranges and keeps filter clearing as a draft until applied', async () => {
    const user = userEvent.setup();
    render(<Workspace />);
    await user.click(
      within(screen.getByRole('navigation', { name: 'Workspace navigation' })).getByRole('link', {
        name: 'Listings and filters',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Filters' }));
    await user.click(screen.getByText('ETA between', { exact: true }));
    const fields = screen.getAllByLabelText('From');
    const toFields = screen.getAllByLabelText('To');
    await user.type(fields[0]!, '2026-09-12');
    await user.type(toFields[0]!, '2026-09-10');
    expect(screen.getByRole('alert')).toHaveTextContent('End date must be on or after start date.');
    expect(screen.getByRole('button', { name: /Show .* results/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save as view' })).toBeDisabled();
    await user.clear(toFields[0]!);
    await user.type(toFields[0]!, '2026-09-15');
    await user.click(screen.getByRole('button', { name: 'Show 2 results' }));
    expect(screen.getByText('Showing 1\u20132 of 2')).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Filters/ }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Clear all' }));
    await user.keyboard('{Escape}');
    expect(screen.getByText('Showing 1\u20132 of 2')).toBeVisible();
    await chooseOption(user, 'View state', 'Loading');
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    await chooseOption(user, 'View state', 'Error');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByRole('table')).toBeVisible();
  });
});
