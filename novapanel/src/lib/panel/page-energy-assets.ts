import { fetchWithTimeout } from '$lib/fetch-with-timeout';

const ENERGY_UPLOAD_TIMEOUT_MS = 20000;
const ENERGY_DELETE_TIMEOUT_MS = 10000;

export function getIngressBase(): string {
	if (typeof window === 'undefined') return '';
	return (window as unknown as { __novapanel_ingress?: string }).__novapanel_ingress || '';
}

export function energyAssetUploadUrl(
	cardId: string,
	variant: string,
	ingressBase = getIngressBase()
): string {
	return `${ingressBase}/api/energy-asset/upload?cardId=${encodeURIComponent(cardId)}&variant=${encodeURIComponent(variant)}`;
}

export function energyAssetDeleteUrl(
	cardId: string,
	variant: string,
	ingressBase = getIngressBase()
): string {
	return `${ingressBase}/api/energy-asset?cardId=${encodeURIComponent(cardId)}&variant=${encodeURIComponent(variant)}`;
}

export function energyCustomAssetUrl(
	cardId: string,
	variant: string,
	cacheBuster: number | string = '',
	ingressBase = getIngressBase()
): string {
	const url = `${ingressBase}/energy-asset/${encodeURIComponent(cardId)}/${encodeURIComponent(variant)}`;
	return cacheBuster === '' ? url : `${url}?t=${encodeURIComponent(String(cacheBuster))}`;
}

export function energyDefaultAssetUrl(variant: string, ingressBase = getIngressBase()): string {
	return `${ingressBase}/energy/${encodeURIComponent(variant)}.png`;
}

export function pickEnergyAssetFile(onFile: (file: File) => void | Promise<void>): void {
	if (typeof document === 'undefined') return;
	const input = document.createElement('input');
	input.type = 'file';
	input.accept = 'image/png,image/jpeg';
	input.onchange = () => {
		const file = input.files?.[0];
		if (file) void onFile(file);
	};
	input.click();
}

export async function uploadEnergyAsset(cardId: string, variant: string, file: File): Promise<boolean> {
	const formData = new FormData();
	formData.append('file', file);
	const response = await fetchWithTimeout(
		energyAssetUploadUrl(cardId, variant),
		{ method: 'POST', body: formData },
		ENERGY_UPLOAD_TIMEOUT_MS
	);
	return response.ok;
}

export async function deleteEnergyAsset(cardId: string, variant: string): Promise<boolean> {
	const response = await fetchWithTimeout(
		energyAssetDeleteUrl(cardId, variant),
		{ method: 'DELETE' },
		ENERGY_DELETE_TIMEOUT_MS
	);
	return response.ok;
}
