<script lang="ts">
	type Props = {
		src: string;
		alt?: string;
		onAspectRatio?: (ratio: number) => void;
		onLoaded?: (src: string) => void;
		onError?: (src: string) => void;
	};

	let { src, alt = '', onAspectRatio, onLoaded, onError }: Props = $props();

	let displaySrc = $state('');
	let loadToken = 0;

	function publishRatio(width: number, height: number) {
		if (width <= 0 || height <= 0) return;
		const ratio = width / height;
		if (Number.isFinite(ratio) && ratio > 0) onAspectRatio?.(ratio);
	}

	$effect(() => {
		const nextSrc = src;
		if (!nextSrc || nextSrc === displaySrc || typeof window === 'undefined') return;
		const token = ++loadToken;
		const image = new Image();
		image.decoding = 'async';
		image.onload = () => {
			if (token !== loadToken) return;
			publishRatio(image.naturalWidth, image.naturalHeight);
			onLoaded?.(nextSrc);
			displaySrc = nextSrc;
		};
		image.onerror = () => {
			if (token !== loadToken) return;
			onError?.(nextSrc);
		};
		image.src = nextSrc;
		return () => {
			loadToken++;
			image.onload = null;
			image.onerror = null;
		};
	});
</script>

{#if displaySrc}
	<img
		class="camera-preview-img"
		src={displaySrc}
		alt={alt}
		loading="lazy"
		onload={(event) => {
			const image = event.currentTarget as HTMLImageElement;
			publishRatio(image.naturalWidth, image.naturalHeight);
		}}
	/>
{:else}
	<div class="camera-preview-loading" aria-hidden="true"></div>
{/if}

<style>
	.camera-preview-img,
	.camera-preview-loading {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
		object-fit: cover;
		background: #050812;
	}

	.camera-preview-loading {
		background:
			linear-gradient(135deg, rgba(96,165,250,0.10), rgba(167,139,250,0.10)),
			#050812;
	}
</style>
