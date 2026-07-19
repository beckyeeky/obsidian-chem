import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import initRDKitModule from '@rdkit/rdkit';

jest.mock(
	'obsidian',
	() => ({
		normalizePath: (path: string) => path,
		requestUrl: () => undefined,
		Notice: class {},
		moment: { locale: () => 'en' },
	}),
	{ virtual: true }
);

import { DEFAULT_SETTINGS } from 'src/settings/base';
import RDKitCore from './rdkitCore';

const moleculeSvg = '<svg width="100" height="50"></svg>';
const reactionSvg = '<svg width="120" height="60"></svg>';

let renderedMarkup: string[];

beforeEach(() => {
	renderedMarkup = [];
	(
		globalThis as typeof globalThis & { createDiv: typeof createDiv }
	).createDiv = jest.fn(() => {
		const svg = {
			setAttribute: jest.fn(),
			width: { baseVal: { value: 100 } },
			height: { baseVal: { value: 50 } },
			style: {},
		} as unknown as SVGSVGElement & HTMLElement;
		let markup = '';
		return {
			set innerHTML(value: string) {
				markup = value;
				renderedMarkup.push(value);
			},
			get innerHTML() {
				return markup;
			},
			find: jest.fn(() => svg),
		} as unknown as HTMLDivElement;
	});
});

describe('RDKitCore WASM object lifetime', () => {
	test('repeated molecule and reaction renders release every object without changing SVG output', async () => {
		let liveObjects = 0;
		let moleculeDeleteCalls = 0;
		let reactionDeleteCalls = 0;
		const core = {
			get_mol: jest.fn(() => {
				liveObjects += 1;
				const remove = jest.fn(() => {
					moleculeDeleteCalls += 1;
					liveObjects -= 1;
				});
				return {
					delete: remove,
					condense_abbreviations: jest.fn(),
					has_prop: jest.fn(() => false),
					get_prop: jest.fn(),
					get_svg_with_highlights: jest.fn(() => moleculeSvg),
				};
			}),
			get_rxn: jest.fn(() => {
				liveObjects += 1;
				const remove = jest.fn(() => {
					reactionDeleteCalls += 1;
					liveObjects -= 1;
				});
				return {
					delete: remove,
					get_svg_with_highlights: jest.fn(() => reactionSvg),
				};
			}),
		};
		const rdkit = new RDKitCore(DEFAULT_SETTINGS, core as never);

		for (let index = 0; index < 100; index += 1) {
			await rdkit.draw('CCO', 'light');
			await rdkit.draw('CCO>>CC=O', 'light');
			expect(liveObjects).toBe(0);
		}

		expect(moleculeDeleteCalls).toBe(100);
		expect(reactionDeleteCalls).toBe(100);
		expect(renderedMarkup).toHaveLength(200);
		expect(renderedMarkup[0]).toBe(moleculeSvg);
		expect(renderedMarkup[1]).toBe(reactionSvg);
	});

	test('real RDKit WASM heap stays stable across 2400 wrapper renders', async () => {
		const loadRDKit = initRDKitModule as unknown as () => Promise<{
			HEAP8: Uint8Array;
		}>;
		const core = await loadRDKit();
		const rdkit = new RDKitCore(DEFAULT_SETTINGS, core as never);

		await rdkit.draw('CC(=O)Oc1ccccc1C(=O)O', 'light');
		await rdkit.draw('CCO>>CC=O', 'light');
		const initialHeapBytes = core.HEAP8.buffer.byteLength;
		renderedMarkup = [];

		for (let index = 0; index < 1200; index += 1) {
			await rdkit.draw('CC(=O)Oc1ccccc1C(=O)O', 'light');
			await rdkit.draw('CCO>>CC=O', 'light');
		}

		expect(renderedMarkup).toHaveLength(2400);
		expect(core.HEAP8.buffer.byteLength).toBe(initialHeapBytes);
	}, 30000);

	const expectReleaseAfterFailure = async (
		source: string,
		getter: 'get_mol' | 'get_rxn'
	) => {
		const remove = jest.fn();
		const rdkitObject = {
			delete: remove,
			condense_abbreviations: jest.fn(),
			has_prop: jest.fn(() => false),
			get_prop: jest.fn(),
			get_svg_with_highlights: jest.fn(() => {
				throw new Error('render failed');
			}),
		};
		const core = {
			[getter]: jest.fn(() => rdkitObject),
		};
		const rdkit = new RDKitCore(DEFAULT_SETTINGS, core as never);

		await expect(rdkit.draw(source, 'light')).rejects.toThrow('render failed');
		expect(remove).toHaveBeenCalledTimes(1);
	};

	test('releases a molecule when SVG generation throws', async () => {
		await expectReleaseAfterFailure('CCO', 'get_mol');
	});

	test('releases a reaction when SVG generation throws', async () => {
		await expectReleaseAfterFailure('CCO>>CC=O', 'get_rxn');
	});
});
