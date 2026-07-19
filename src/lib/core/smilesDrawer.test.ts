/** @jest-environment jsdom */

import { describe, expect, test } from '@jest/globals';

interface SmilesDrawerParser {
	SmiDrawer: new (moleculeOptions?: object, reactionOptions?: object) => {
		draw(
			smiles: string,
			target: SVGSVGElement,
			theme: string,
			success: () => void,
			failure: (error: Error) => void
		): void;
	};
	parse(
		smiles: string,
		success: () => void,
		failure: (error: Error) => void
	): void;
	parseReaction(
		smiles: string,
		success: () => void,
		failure: (error: Error) => void
	): void;
}

// The browser bundle attaches its public API to window. Load it directly so
// this test exercises the same DOM-facing renderer used by the plugin bundle.
require('../../../node_modules/smiles-drawer/dist/smiles-drawer.min.js');

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
	configurable: true,
	value: () => ({ measureText: (text: string) => ({ width: text.length * 8 }) }),
});
Object.defineProperty(SVGSVGElement.prototype, 'viewBox', {
	configurable: true,
	get() {
		const values = (this.getAttribute('viewBox') ?? '0 0 300 300')
			.split(/\s+/)
			.map(Number);
		return { baseVal: { width: values[2], height: values[3] } };
	},
});

const publishedBrowserBundle = () =>
	(window as unknown as { SmilesDrawer: SmilesDrawerParser }).SmilesDrawer;

const parseWithPublishedEsmBundle = (smiles: string, reaction = false) => {
	const parser = reaction ? 'parseReaction' : 'parse';
	return new Promise<void>((resolve, reject) =>
		publishedBrowserBundle()[parser](smiles, () => resolve(), reject)
	);
};

const renderWithPublishedEsmBundle = (smiles: string) =>
	new Promise<SVGSVGElement>((resolve, reject) => {
		const svg = document.createElementNS(
			'http://www.w3.org/2000/svg',
			'svg'
		);
		Object.defineProperties(svg, {
			width: { value: { baseVal: { value: 300 } } },
			height: { value: { baseVal: { value: 300 } } },
		});
		const drawer = new (publishedBrowserBundle().SmiDrawer)();
		drawer.draw(smiles, svg, 'light', () => resolve(svg), reject);
	});

describe('Smiles Drawer 2.4.1 regressions', () => {
	test.each(['[H][H]', 'CCC[C-]', 'C=C=C', 'CC#C', 'CCO'])(
		'parses molecule %s',
		async (smiles) => {
			await expect(parseWithPublishedEsmBundle(smiles)).resolves.toBeUndefined();
		}
	);

	test('parses an ordinary reaction SMILES', async () => {
		await expect(
			parseWithPublishedEsmBundle('CCO>>CC=O', true)
		).resolves.toBeUndefined();
	});

	test.each(['[H][H]', 'CCC[C-]', 'C=C=C', 'CC#C', 'CCO', 'CCO>>CC=O'])(
		'renders SVG content for %s',
		async (smiles) => {
			const svg = await renderWithPublishedEsmBundle(smiles);
			expect(svg.childElementCount).toBeGreaterThan(1);
			expect(svg.querySelectorAll('*').length).toBeGreaterThan(1);
		}
	);
});
