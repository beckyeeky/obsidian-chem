import { Component } from 'obsidian';
import { isPluginEnabled } from 'obsidian-dataview';
import { i18n } from 'src/lib/i18n';
import { getApp } from './app';

/** Minimal surface of the Dataview plugin used by this codebase. */
export interface DataviewPluginRef {
	settings: {
		inlineQueryPrefix: string;
		inlineJsQueryPrefix: string;
		enableInlineDataview: boolean;
		enableDataviewJs: boolean;
		enableInlineDataviewJs: boolean;
	};
	localApi: (
		path: string,
		component: Component,
		el: HTMLElement
	) => {
		evaluate: (
			expression: string
		) =>
			| { successful: true; value: unknown }
			| { successful: false; error: unknown };
	};
}

export let gDataview: DataviewPluginRef | null = null;
export { isPluginEnabled } from 'obsidian-dataview';

export const getDataview = (): DataviewPluginRef => {
	const app = getApp();
	if (isPluginEnabled(app)) {
		// Obsidian's Plugin API is untyped for third-party plugins.
		gDataview = app.plugins.getPlugin(
			'dataview'
		) as unknown as DataviewPluginRef;
		return gDataview;
	}
	throw new Error(i18n.t('errors.dataview.title'));
};

export const clearDataview = () => {
	gDataview = null;
};
