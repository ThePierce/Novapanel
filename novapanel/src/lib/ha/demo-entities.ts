import type { HomeAssistantEntity } from './entities-service-helpers';

function makeEntity(input: {
	entityId: string;
	friendlyName: string;
	state: string;
	unit?: string;
	icon?: string;
	deviceClass?: string;
	attributes?: Record<string, unknown>;
}): HomeAssistantEntity {
	const domain = input.entityId.split('.')[0] || '';
	return {
		entityId: input.entityId,
		friendlyName: input.friendlyName,
		domain,
		state: input.state,
		unit: input.unit ?? '',
		icon: input.icon ?? '',
		deviceClass: input.deviceClass ?? '',
		attributes: {
			friendly_name: input.friendlyName,
			...(input.unit ? { unit_of_measurement: input.unit } : {}),
			...(input.deviceClass ? { device_class: input.deviceClass } : {}),
			...(input.attributes ?? {})
		}
	};
}

function powerSensor(entityId: string, friendlyName: string, value: number): HomeAssistantEntity {
	return makeEntity({
		entityId,
		friendlyName,
		state: String(value),
		unit: 'W',
		deviceClass: 'power',
		attributes: { state_class: 'measurement' }
	});
}

function energySensor(entityId: string, friendlyName: string, value: number): HomeAssistantEntity {
	return makeEntity({
		entityId,
		friendlyName,
		state: String(value),
		unit: 'kWh',
		deviceClass: 'energy',
		attributes: { state_class: 'total_increasing' }
	});
}

export function createDemoHomeAssistantEntities(): HomeAssistantEntity[] {
	return [
		powerSensor('sensor.netto_vermogen', 'Netto vermogen', 740),
		powerSensor('sensor.zonnepanelen_vermogen', 'Zonnepanelen vermogen', 1820),
		powerSensor('sensor.huis_verbruik_vermogen', 'Huisverbruik vermogen', 1220),
		powerSensor('sensor.thuis_batterij_vermogen', 'Thuisbatterij vermogen', -430),
		makeEntity({
			entityId: 'sensor.thuis_batterij_lading',
			friendlyName: 'Thuisbatterij lading',
			state: '64',
			unit: '%',
			deviceClass: 'battery',
			attributes: { state_class: 'measurement' }
		}),
		energySensor('sensor.energie_import_vandaag', 'Energie import vandaag', 4.8),
		energySensor('sensor.energie_export_vandaag', 'Energie export vandaag', 2.1),
		energySensor('sensor.energie_import_piek_vandaag', 'Energie import piek vandaag', 2.9),
		energySensor('sensor.energie_import_dal_vandaag', 'Energie import dal vandaag', 1.9),
		energySensor('sensor.zon_vandaag', 'Zonnepanelen vandaag', 9.6),
		energySensor('sensor.huis_verbruik_vandaag', 'Huisverbruik vandaag', 7.3),
		makeEntity({
			entityId: 'sensor.energie_import_tarief',
			friendlyName: 'Energie import tarief',
			state: '0.37',
			unit: 'EUR/kWh',
			icon: 'mdi:currency-eur',
			attributes: { state_class: 'measurement' }
		}),
		makeEntity({
			entityId: 'sensor.energie_export_tarief',
			friendlyName: 'Energie export tarief',
			state: '0.13',
			unit: 'EUR/kWh',
			icon: 'mdi:currency-eur',
			attributes: { state_class: 'measurement' }
		}),
		makeEntity({
			entityId: 'sensor.kosten_import_vandaag',
			friendlyName: 'Kosten import vandaag',
			state: '1.42',
			unit: 'EUR',
			deviceClass: 'monetary',
			attributes: { state_class: 'total' }
		}),
		makeEntity({
			entityId: 'sensor.compensatie_export_vandaag',
			friendlyName: 'Compensatie export vandaag',
			state: '0.29',
			unit: 'EUR',
			deviceClass: 'monetary',
			attributes: { state_class: 'total' }
		}),
		makeEntity({
			entityId: 'sensor.zelfvoorzienend_vandaag',
			friendlyName: 'Zelfvoorzienend vandaag',
			state: '71',
			unit: '%',
			attributes: { state_class: 'measurement' }
		}),

		powerSensor('sensor.vaatwasser_vermogen', 'Vaatwasser keuken beneden', 84),
		energySensor('sensor.vaatwasser_energie_vandaag', 'Vaatwasser keuken beneden vandaag', 1.14),
		powerSensor('sensor.wasdrogers_vermogen', 'Wasdroger zolder links', 640),
		energySensor('sensor.wasdrogers_energie_vandaag', 'Wasdroger zolder links vandaag', 2.36),
		powerSensor('sensor.wasmachine_vermogen', 'Wasmachine bijkeuken', 12),
		energySensor('sensor.wasmachine_energie_vandaag', 'Wasmachine bijkeuken vandaag', 0.82),
		powerSensor('sensor.koelkast_vermogen', 'Koelkast keuken lang apparaatnaam', 96),
		energySensor('sensor.koelkast_energie_vandaag', 'Koelkast keuken lang apparaatnaam vandaag', 0.74),
		powerSensor('sensor.warmtepomp_vermogen', 'Warmtepomp technische ruimte', 1120),
		energySensor('sensor.warmtepomp_energie_vandaag', 'Warmtepomp technische ruimte vandaag', 4.83),
		powerSensor('sensor.robovac_vermogen', 'Robovac laadstation woonkamer', 18),
		energySensor('sensor.robovac_energie_vandaag', 'Robovac laadstation woonkamer vandaag', 0.08),

		makeEntity({
			entityId: 'light.woonkamer',
			friendlyName: 'Lamp woonkamer',
			state: 'off',
			icon: 'mdi:ceiling-light',
			attributes: {
				brightness: 0,
				supported_color_modes: ['brightness', 'color_temp'],
				supported_features: 40
			}
		}),
		makeEntity({
			entityId: 'light.keuken',
			friendlyName: 'Lamp keuken',
			state: 'on',
			icon: 'mdi:pendant-light',
			attributes: {
				brightness: 186,
				color_temp_kelvin: 3100,
				supported_color_modes: ['brightness', 'color_temp'],
				supported_features: 40
			}
		}),
		makeEntity({
			entityId: 'switch.koffiezetter',
			friendlyName: 'Koffiezetter',
			state: 'on',
			icon: 'mdi:coffee-maker'
		}),
		makeEntity({
			entityId: 'lock.voordeur',
			friendlyName: 'Voordeur slot',
			state: 'unlocked',
			icon: 'mdi:lock-open-variant'
		}),
		makeEntity({
			entityId: 'binary_sensor.voordeur_contact',
			friendlyName: 'Voordeur contact',
			state: 'on',
			deviceClass: 'door'
		}),
		makeEntity({
			entityId: 'cover.gordijnen_woonkamer',
			friendlyName: 'Gordijnen woonkamer',
			state: 'open',
			icon: 'mdi:curtains',
			attributes: { current_position: 72, supported_features: 15 }
		}),
		makeEntity({
			entityId: 'climate.woonkamer',
			friendlyName: 'Thermostaat woonkamer',
			state: 'heat',
			attributes: {
				current_temperature: 20.8,
				temperature: 21.5,
				hvac_modes: ['off', 'heat'],
				supported_features: 385
			}
		}),
		makeEntity({
			entityId: 'media_player.google_nest_woonkamer',
			friendlyName: 'Google Nest woonkamer',
			state: 'playing',
			icon: 'mdi:speaker',
			attributes: {
				app_name: 'Spotify',
				manufacturer: 'Google',
				media_title: 'Nova Panel demo playlist',
				volume_level: 0.32,
				is_volume_muted: false
			}
		}),
		makeEntity({
			entityId: 'vacuum.roborock_s8',
			friendlyName: 'Robovac woonkamer',
			state: 'cleaning',
			icon: 'mdi:robot-vacuum',
			attributes: {
				battery_level: 86,
				fan_speed: 'balanced',
				fan_speed_list: ['quiet', 'balanced', 'turbo', 'max'],
				cleaned_area: 42,
				cleaning_time: 38
			}
		}),
		makeEntity({
			entityId: 'camera.roborock_s8_map',
			friendlyName: 'Robovac woonkamer kaart',
			state: 'idle',
			attributes: {
				entity_picture:
					'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 640 480%22%3E%3Crect width=%22640%22 height=%22480%22 fill=%22%23111827%22/%3E%3Cg fill=%22none%22 stroke-width=%224%22%3E%3Cpath d=%22M70 70h310v340H70z%22 fill=%22%230f2f2a%22 stroke=%22%2334d399%22 opacity=%22.82%22/%3E%3Cpath d=%22M405 70h165v155H405z%22 fill=%22%2311233a%22 stroke=%22%2360a5fa%22 opacity=%22.82%22/%3E%3Cpath d=%22M405 250h165v160H405z%22 fill=%22%231f2937%22 stroke=%22%23ffffff%22 opacity=%22.45%22/%3E%3Cpath d=%22M135 145c130-60 298 6 295 104-3 94-164 119-252 70%22 stroke=%22%2334d399%22 stroke-dasharray=%2216 12%22 opacity=%22.8%22/%3E%3C/g%3E%3Ccircle cx=%22418%22 cy=%22248%22 r=%2218%22 fill=%22%2334d399%22/%3E%3Ccircle cx=%22103%22 cy=%22372%22 r=%2212%22 fill=%22%23e5e7eb%22/%3E%3Ctext x=%2278%22 y=%22102%22 fill=%22%23e5e7eb%22 font-family=%22Arial%22 font-size=%2222%22%3EWoonkamer%3C/text%3E%3Ctext x=%22424%22 y=%22104%22 fill=%22%23e5e7eb%22 font-family=%22Arial%22 font-size=%2220%22%3EKeuken%3C/text%3E%3C/svg%3E'
			}
		}),
		makeEntity({
			entityId: 'camera.voordeur',
			friendlyName: 'Camera voordeur',
			state: 'idle',
			attributes: { supported_features: 2 }
		}),
		makeEntity({
			entityId: 'weather.thuis',
			friendlyName: 'Weer thuis',
			state: 'partlycloudy',
			unit: 'C',
			attributes: { temperature: 18.4, humidity: 73, pressure: 1017 }
		})
	];
}
