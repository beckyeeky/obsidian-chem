import { describe, expect, test } from '@jest/globals';
import {
	CachedChemCore,
	MAX_RENDER_CACHE_ENTRIES,
	RenderCache,
} from './renderCache';

const element = (id: string) =>
	({
		id,
		cloneNode: () => element(id),
	}) as unknown as SVGSVGElement;

describe('RenderCache', () => {
	test('returns independent clones while deduplicating an in-flight render', async () => {
		const cache = new RenderCache();
		let calls = 0;
		let resolve: (value: SVGSVGElement) => void = () => undefined;
		const render = () => {
			calls += 1;
			return new Promise<SVGSVGElement>((done) => (resolve = done));
		};

		const first = cache.draw('same', render);
		const second = cache.draw('same', render);
		resolve(element('shared'));
		const [a, b] = await Promise.all([first, second]);

		expect(calls).toBe(1);
		expect(a).not.toBe(b);
		expect(cache.snapshot()).toMatchObject({
			calls: 2,
			cacheHits: 1,
			cacheMisses: 1,
			deduplicated: 1,
		});
	});

	test('evicts the oldest entry when its bounded capacity is exceeded', async () => {
		const cache = new RenderCache();
		let calls = 0;
		for (let index = 0; index <= MAX_RENDER_CACHE_ENTRIES; index += 1) {
			await cache.draw(`${index}`, async () => {
				calls += 1;
				return element(`${index}`);
			});
		}
		await cache.draw('0', async () => {
			calls += 1;
			return element('0');
		});
		expect(calls).toBe(MAX_RENDER_CACHE_ENTRIES + 2);
	});

	test('retains a recently used entry when evicting', async () => {
		const cache = new RenderCache();
		let calls = 0;
		const render = async (id: string) => {
			calls += 1;
			return element(id);
		};
		for (let index = 0; index < MAX_RENDER_CACHE_ENTRIES; index += 1)
			await cache.draw(`${index}`, () => render(`${index}`));
		await cache.draw('0', () => render('0'));
		await cache.draw('new', () => render('new'));
		await cache.draw('0', () => render('0'));

		expect(calls).toBe(MAX_RENDER_CACHE_ENTRIES + 1);
	});

	test('keys output by renderer, source, theme, and settings', async () => {
		let calls = 0;
		const core = new CachedChemCore({
			id: 'smiles-drawer',
			core: {},
			settings: { core: 'smiles-drawer' } as never,
			draw: async () => {
				calls += 1;
				return element(`${calls}`);
			},
		});

		await core.draw('CCO', 'light');
		await core.draw('CCO', 'light');
		await core.draw('CCO', 'dark');
		core.settings = {
			core: 'smiles-drawer',
			commonOptions: { width: 400 },
		} as never;
		await core.draw('CCO', 'dark');

		expect(calls).toBe(3);
	});

	test('does not let a rejected evicted render remove a newer cache entry', async () => {
		const cache = new RenderCache();
		let rejectFirst: (error: Error) => void = () => undefined;
		const first = cache.draw(
			'key',
			() => new Promise<SVGSVGElement>((_, reject) => (rejectFirst = reject))
		);
		for (let index = 0; index < MAX_RENDER_CACHE_ENTRIES; index += 1)
			await cache.draw(`${index}`, async () => element(`${index}`));
		let replacementCalls = 0;
		const replacement = cache.draw('key', async () => {
			replacementCalls += 1;
			return element('replacement');
		});
		rejectFirst(new Error('first render failed'));
		await expect(first).rejects.toThrow('first render failed');
		await replacement;
		await cache.draw('key', async () => {
			replacementCalls += 1;
			return element('unexpected');
		});

		expect(replacementCalls).toBe(1);
	});
});
