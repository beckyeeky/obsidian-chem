import { ChemPluginSettings } from 'src/settings/base';

import type { ChemCore } from 'src/lib/core/ChemCore';
import SmilesDrawerCore from '../lib/core/smilesDrawerCore';
import RDKitCore from '../lib/core/rdkitCore';
import { CachedChemCore } from '../lib/core/renderCache';

export let gRenderCore: ChemCore;

export const setCore = async (
	settings: ChemPluginSettings,
	onFallback: (error: string) => void
) => {
	if (!gRenderCore || settings.core !== gRenderCore.id) {
		if (settings.core === 'smiles-drawer') {
			gRenderCore = new CachedChemCore(new SmilesDrawerCore(settings));
			updateCoreSettings(settings);
		} else if (settings.core === 'rdkit') {
			try {
				gRenderCore = new CachedChemCore(await RDKitCore.init(settings));
				updateCoreSettings(settings);
			} catch (error) {
				onFallback(error);
			}
		} else {
			onFallback(`invalid chem core id. ${settings.core}`);
		}
	}
};

export const setFallbackCore = async (settings: ChemPluginSettings) => {
	gRenderCore = new CachedChemCore(new SmilesDrawerCore(settings));
	updateCoreSettings(settings);
};

export const updateCoreSettings = (settings: ChemPluginSettings) => {
	gRenderCore.settings = settings;
};

export const clearCore = () => {
	const rdkitBundler = document.getElementById('chem-rdkit-bundler');
	if (rdkitBundler) document.body.removeChild(rdkitBundler);

	//@ts-ignore
	delete window.RDKit;
	//@ts-ignore
	delete window.initRDKitModule;
	//@ts-ignore
	delete window.SmilesDrawer;
	//@ts-ignore
	delete window.SmiDrawer;
};
