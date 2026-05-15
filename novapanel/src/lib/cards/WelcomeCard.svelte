<script lang="ts">
	import { selectedLanguageStore, translate } from '$lib/i18n';

	const readmeUrl = 'https://github.com/ThePierce/Novapanel#readme';
</script>

<div class="welcome-card">
	<div class="welcome-center">
		<div class="welcome-mark" aria-hidden="true">N</div>
		<div class="welcome-copy">
			<span>{translate('Welkom bij', $selectedLanguageStore)}</span>
			<strong>Novapanel</strong>
			<p>{translate('Begin met een leeg dashboard en voeg zelf secties, kaarten en Home Assistant-entiteiten toe.', $selectedLanguageStore)}</p>
		</div>
	</div>
	<a class="welcome-link" href={readmeUrl} target="_blank" rel="noreferrer">
		README
	</a>
</div>

<style>
	.welcome-card {
		min-height: 16rem;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: clamp(1.25rem, 2vw, 1.8rem);
		border-radius: 18px;
		background:
			radial-gradient(circle at 18% 18%, rgba(96,165,250,0.28), transparent 42%),
			linear-gradient(145deg, rgba(255,255,255,0.105), rgba(255,255,255,0.035)),
			#20293a;
		box-shadow:
			inset 0 0 0 1px rgba(255,255,255,0.075),
			0 18px 45px rgba(0,0,0,0.22);
		box-sizing: border-box;
	}

	.welcome-center {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1.1rem;
		max-width: min(100%, 44rem);
		text-align: left;
	}

	.welcome-mark {
		width: 4.6rem;
		height: 4.6rem;
		flex: 0 0 auto;
		display: grid;
		place-items: center;
		border-radius: 1.15rem;
		color: #bfdbfe;
		font-size: 2.1rem;
		font-weight: 860;
		background: rgba(96,165,250,0.18);
		box-shadow: inset 0 0 0 1px rgba(147,197,253,0.22);
	}

	.welcome-copy {
		min-width: 0;
		display: grid;
		gap: 0.25rem;
	}

	.welcome-copy span {
		color: rgba(255,255,255,0.58);
		font-size: 0.86rem;
		font-weight: 720;
	}

	.welcome-copy strong {
		color: #fff;
		font-size: clamp(1.8rem, 4vw, 3rem);
		line-height: 1;
		font-weight: 820;
		letter-spacing: 0;
	}

	.welcome-copy p {
		max-width: 38rem;
		margin: 0.35rem 0 0;
		color: rgba(255,255,255,0.68);
		font-size: 0.96rem;
		line-height: 1.45;
	}

	.welcome-link {
		position: absolute;
		right: clamp(1rem, 1.8vw, 1.55rem);
		bottom: clamp(1rem, 1.8vw, 1.55rem);
		height: 2.45rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0 0.9rem;
		border-radius: 0.72rem;
		color: #dbeafe;
		font-size: 0.82rem;
		font-weight: 780;
		text-decoration: none;
		background: rgba(96,165,250,0.16);
		box-shadow: inset 0 0 0 1px rgba(147,197,253,0.22);
	}

	.welcome-link:hover {
		background: rgba(96,165,250,0.24);
	}

	@media (max-width: 720px) {
		.welcome-card {
			min-height: 18rem;
			justify-content: center;
			padding-bottom: 4.6rem;
		}

		.welcome-center {
			flex-direction: column;
			text-align: center;
		}
	}
</style>
