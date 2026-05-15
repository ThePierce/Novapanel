<script lang="ts">
	import { entityStore } from '$lib/ha/entities-store';
	import type { CameraConfig } from '$lib/persistence/panel-state-types';
	import TablerIcon from '$lib/icons/TablerIcon.svelte';

	type CalendarSource = CameraConfig;

	type Props = {
		sources?: CalendarSource[];
		onSourcesChange: (value: CalendarSource[]) => void;
	};

	let { sources = [], onSourcesChange }: Props = $props();

	const calendarEntities = $derived(
		$entityStore.entities
			.filter((entity) => entity.domain === 'calendar')
			.sort((a, b) => a.friendlyName.localeCompare(b.friendlyName))
	);
	const personEntities = $derived(
		$entityStore.entities
			.filter((entity) => entity.domain === 'person')
			.sort((a, b) => a.friendlyName.localeCompare(b.friendlyName))
	);
	const calendarListId = 'week-calendar-entities';
	const personListId = 'week-calendar-person-entities';

	const palette = ['#a7f3d0', '#fde68a', '#93c5fd', '#f9a8d4', '#c4b5fd'];
	const normalizedSources = $derived(sources ?? []);

	function entityName(entityId: string) {
		return calendarEntities.find((entity) => entity.entityId === entityId)?.friendlyName ?? entityId;
	}

	function personName(entityId: string) {
		return personEntities.find((entity) => entity.entityId === entityId)?.friendlyName ?? entityId;
	}

	function normalizeName(value: string) {
		return value
			.toLowerCase()
			.replace(/^calendar\./, '')
			.replace(/^person\./, '')
			.replace(/[_\-.]+/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
	}

	function guessedPersonEntityId(entityId: string, alias = '') {
		const candidates = [alias, entityName(entityId), entityId].map(normalizeName).filter(Boolean);
		const match = personEntities.find((person) => {
			const personKeys = [person.friendlyName, person.entityId].map(normalizeName).filter(Boolean);
			return personKeys.some((personKey) =>
				candidates.some((candidate) => candidate === personKey || candidate.includes(personKey) || personKey.includes(candidate))
			);
		});
		return match?.entityId ?? '';
	}

	function addSource() {
		const firstUnused =
			calendarEntities.find((entity) => !normalizedSources.some((source) => source.entityId === entity.entityId))
				?.entityId ?? '';
		onSourcesChange([
			...normalizedSources,
			{
				entityId: firstUnused,
				alias: firstUnused ? entityName(firstUnused) : '',
				color: palette[normalizedSources.length % palette.length],
				personEntityId: firstUnused ? guessedPersonEntityId(firstUnused, entityName(firstUnused)) : ''
			}
		]);
	}

	function updateSource(index: number, patch: Partial<CalendarSource>) {
		onSourcesChange(
			normalizedSources.map((source, sourceIndex) => {
				if (sourceIndex !== index) return source;
				const next = { ...source, ...patch };
				if (patch.entityId && (!source.alias || source.alias === entityName(source.entityId))) {
					next.alias = entityName(patch.entityId);
				}
				if ((patch.entityId || patch.alias) && !source.personEntityId) {
					next.personEntityId = guessedPersonEntityId(next.entityId, next.alias ?? '');
				}
				return next;
			})
		);
	}

	function removeSource(index: number) {
		onSourcesChange(normalizedSources.filter((_, sourceIndex) => sourceIndex !== index));
	}

	function moveSource(index: number, direction: -1 | 1) {
		const targetIndex = index + direction;
		if (targetIndex < 0 || targetIndex >= normalizedSources.length) return;
		const next = [...normalizedSources];
		const [source] = next.splice(index, 1);
		if (!source) return;
		next.splice(targetIndex, 0, source);
		onSourcesChange(next);
	}
</script>

<div class="week-calendar-editor">
	<div class="calendar-editor-head">
		<div>
			<strong>Kalenders</strong>
			<span>Kies CalDAV kalender-entiteiten, koppel optioneel een person-entiteit, geef iedere persoon een kleur en zet ze in de juiste volgorde.</span>
		</div>
		<button type="button" class="np-mini-btn primary" onclick={addSource}>
			<TablerIcon name="plus" size={13} />
			Persoon toevoegen
		</button>
	</div>

	{#if normalizedSources.length === 0}
		<div class="calendar-editor-empty">
			Nog geen kalenders geselecteerd. Je kunt ook handmatig een entity id invullen, bijvoorbeeld
			<code>calendar.family</code>.
		</div>
	{/if}

	<datalist id={calendarListId}>
		{#each calendarEntities as entity (entity.entityId)}
			<option value={entity.entityId}>{entity.friendlyName}</option>
		{/each}
	</datalist>

	<datalist id={personListId}>
		{#each personEntities as entity (entity.entityId)}
			<option value={entity.entityId}>{entity.friendlyName}</option>
		{/each}
	</datalist>

	<div class="calendar-source-list">
		{#each normalizedSources as source, index}
			<div class="calendar-source-row">
				<input
					class="calendar-color"
					type="color"
					value={source.color ?? palette[index % palette.length]}
					aria-label="Kleur"
					oninput={(event) => updateSource(index, { color: (event.currentTarget as HTMLInputElement).value })}
				/>
				<input
					type="text"
					class="calendar-entity-input"
					list={calendarListId}
					value={source.entityId}
					placeholder="calendar.persoon"
					oninput={(event) => updateSource(index, { entityId: (event.currentTarget as HTMLInputElement).value.trim() })}
				/>
				<input
					type="text"
					value={source.alias ?? ''}
					placeholder={source.entityId ? entityName(source.entityId) : 'Naam'}
					oninput={(event) => updateSource(index, { alias: (event.currentTarget as HTMLInputElement).value })}
				/>
				<input
					type="text"
					class="calendar-person-input"
					list={personListId}
					value={source.personEntityId ?? ''}
					placeholder={source.personEntityId ? personName(source.personEntityId) : 'person.persoon'}
					oninput={(event) => updateSource(index, { personEntityId: (event.currentTarget as HTMLInputElement).value.trim() })}
				/>
				<div class="calendar-order-actions" aria-label="Volgorde aanpassen">
					<button
						type="button"
						class="np-mini-btn ghost"
						aria-label="Omhoog"
						disabled={index === 0}
						onclick={() => moveSource(index, -1)}
					>
						<TablerIcon name="arrow-up" size={13} />
					</button>
					<button
						type="button"
						class="np-mini-btn ghost"
						aria-label="Omlaag"
						disabled={index === normalizedSources.length - 1}
						onclick={() => moveSource(index, 1)}
					>
						<TablerIcon name="arrow-down" size={13} />
					</button>
				</div>
				<button type="button" class="np-mini-btn ghost danger" aria-label="Verwijderen" onclick={() => removeSource(index)}>
					<TablerIcon name="trash" size={13} />
				</button>
			</div>
		{/each}
	</div>
</div>

<style>
	.week-calendar-editor {
		display: grid;
		gap: 0.75rem;
	}
	.calendar-editor-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}
	.calendar-editor-head strong {
		display: block;
		color: #f5f5f5;
		font-size: 0.9rem;
	}
	.calendar-editor-head span,
	.calendar-editor-empty {
		display: block;
		margin-top: 0.2rem;
		color: rgba(255,255,255,0.58);
		font-size: 0.78rem;
		line-height: 1.25;
	}
	.calendar-editor-empty {
		margin-top: 0;
		padding: 0.75rem;
		border-radius: 0.65rem;
		background: rgba(255,255,255,0.055);
	}
	.calendar-editor-empty code {
		color: #bae6fd;
	}
	.calendar-source-list {
		display: grid;
		gap: 0.55rem;
	}
	.calendar-source-row {
		display: grid;
		grid-template-columns: auto minmax(0, 1.05fr) minmax(0, 0.78fr) minmax(0, 0.9fr) auto auto;
		align-items: center;
		gap: 0.5rem;
		padding: 0.55rem;
		border-radius: 0.72rem;
		background: rgba(255,255,255,0.045);
		box-shadow: inset 0 0 0 1px rgba(255,255,255,0.065);
	}
	.calendar-color {
		width: 2.1rem;
		height: 2.1rem;
		border: 0;
		padding: 0;
		background: transparent;
		cursor: pointer;
	}
	.calendar-order-actions {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
	}
	.calendar-entity-input,
	.calendar-person-input,
	input[type='text'] {
		min-width: 0;
		height: 2.15rem;
		border: 1px solid rgba(255,255,255,0.09);
		border-radius: 0.55rem;
		background: rgba(255,255,255,0.075);
		color: #f5f5f5;
		padding: 0 0.65rem;
	}
	.np-mini-btn {
		height: 2.05rem;
		border: 0;
		border-radius: 0.5rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		padding: 0 0.65rem;
		color: #f5f5f5;
		background: rgba(255,255,255,0.08);
		cursor: pointer;
	}
	.np-mini-btn.primary {
		background: rgba(56,189,248,0.22);
		color: #bae6fd;
	}
	.np-mini-btn.ghost.danger {
		color: #fca5a5;
	}
	.np-mini-btn.ghost:disabled {
		color: rgba(255,255,255,0.35);
	}
	.np-mini-btn:disabled {
		opacity: 0.45;
		cursor: default;
	}
	@media (max-width: 720px) {
		.calendar-editor-head,
		.calendar-source-row {
			grid-template-columns: 1fr;
			align-items: stretch;
		}
		.calendar-editor-head {
			display: grid;
		}
		.calendar-color {
			width: 100%;
		}
	}
</style>
