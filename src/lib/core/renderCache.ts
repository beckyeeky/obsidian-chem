import type { ChemCore } from './ChemCore';
import type { ChemPluginSettings } from 'src/settings/base';
import { getCurrentTheme } from 'src/lib/themes/getCurrentTheme';

type RenderedElement = HTMLDivElement | SVGSVGElement;

export interface RenderMetrics {
	calls: number;
	cacheHits: number;
	cacheMisses: number;
	deduplicated: number;
	totalRenderMs: number;
}

export const MAX_RENDER_CACHE_ENTRIES = 64;

const clone = (element: RenderedElement): RenderedElement =>
	element.cloneNode(true) as RenderedElement;

const now = () =>
	typeof performance === 'undefined' ? Date.now() : performance.now();

/**
 * Renderer output is immutable after it is inserted into the editor. Cache a
 * template and return a clone for each consumer so one Markdown child cannot
 * reparent another child's SVG.
 */
export class RenderCache {
	private readonly entries = new Map<string, Promise<RenderedElement>>();
	private metrics: RenderMetrics = {
		calls: 0,
		cacheHits: 0,
		cacheMisses: 0,
		deduplicated: 0,
		totalRenderMs: 0,
	};

	async draw(
		key: string,
		render: () => Promise<RenderedElement>
	): Promise<RenderedElement> {
		this.metrics.calls += 1;
		const cached = this.entries.get(key);
		if (cached) {
			this.metrics.cacheHits += 1;
			this.metrics.deduplicated += 1;
			// Map insertion order makes this a true LRU cache.
			this.entries.delete(key);
			this.entries.set(key, cached);
			return clone(await cached);
		}

		this.metrics.cacheMisses += 1;
		const startedAt = now();
		const entry = render().then((element) => {
			this.metrics.totalRenderMs += now() - startedAt;
			return clone(element);
		});
		this.entries.set(key, entry);
		this.trim();

		try {
			return clone(await entry);
		} catch (error) {
			// An evicted key may already have been rendered again while this
			// promise was settling; never discard that newer entry.
			if (this.entries.get(key) === entry) this.entries.delete(key);
			throw error;
		}
	}

	clear() {
		this.entries.clear();
	}

	snapshot(): RenderMetrics {
		return { ...this.metrics };
	}

	private trim() {
		while (this.entries.size > MAX_RENDER_CACHE_ENTRIES) {
			const oldest = this.entries.keys().next().value;
			if (!oldest) return;
			this.entries.delete(oldest);
		}
	}
}

const stableStringify = (value: unknown): string => {
	if (value === null || typeof value !== 'object') return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
	const record = value as Record<string, unknown>;
	return `{${Object.keys(record)
		.sort()
		.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
		.join(',')}}`;
};

/** A cache boundary shared by inline, block, and copy/export render paths. */
export class CachedChemCore implements ChemCore {
	readonly cache = new RenderCache();

	constructor(private readonly renderer: ChemCore) {}

	get id() {
		return this.renderer.id;
	}

	get core() {
		return this.renderer.core;
	}

	get settings() {
		return this.renderer.settings;
	}

	set settings(settings: ChemPluginSettings) {
		this.renderer.settings = settings;
		this.cache.clear();
	}

	draw(source: string, theme?: string): Promise<RenderedElement> {
		// Block rendering normally omits the theme and lets the core resolve it
		// from Obsidian. Resolve it here too, otherwise a light/dark switch would
		// incorrectly reuse an entry whose key contains an empty theme.
		const selectedTheme = theme ?? getCurrentTheme(this.renderer.settings);
		const key = [
			this.renderer.id,
			source,
			selectedTheme,
			stableStringify(this.renderer.settings),
		].join('\u0000');
		return this.cache.draw(key, () => this.renderer.draw(source, selectedTheme));
	}
}
