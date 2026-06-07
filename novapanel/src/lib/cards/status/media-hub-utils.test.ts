import { describe, expect, it } from 'vitest';
import { isGoogleCastPlayer } from './media-hub-utils';
import type { HomeAssistantEntity } from '$lib/ha/entities-service-helpers';

function mediaPlayer(partial: Partial<HomeAssistantEntity>): HomeAssistantEntity {
	return {
		entityId: partial.entityId ?? 'media_player.test',
		friendlyName: partial.friendlyName ?? 'Test player',
		domain: 'media_player',
		state: partial.state ?? 'idle',
		unit: '',
		icon: '',
		deviceClass: '',
		attributes: partial.attributes ?? {}
	};
}

describe('media hub utils', () => {
	it('recognizes abbreviated Google Home Hub entity ids', () => {
		expect(isGoogleCastPlayer(mediaPlayer({ entityId: 'media_player.gh_hub_woonkamer_2' }))).toBe(true);
	});

	it('recognizes Google/Nest metadata', () => {
		expect(
			isGoogleCastPlayer(
				mediaPlayer({
					entityId: 'media_player.living_room',
					friendlyName: 'Nest Hub woonkamer',
					attributes: { manufacturer: 'Google' }
				})
			)
		).toBe(true);
	});

	it('does not treat ordinary receivers as Google Cast players', () => {
		expect(
			isGoogleCastPlayer(
				mediaPlayer({
					entityId: 'media_player.onkyo_woonkamer',
					friendlyName: 'Onkyo woonkamer',
					attributes: { manufacturer: 'Onkyo' }
				})
			)
		).toBe(false);
	});
});
