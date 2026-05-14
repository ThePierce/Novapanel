export type ClockStyle =
	| 'digital'
	| 'classic'
	| 'luxury_gold'
	| 'luxury_steel'
	| 'minimal'
	| 'dark'
	| 'dots'
	| 'aurora';

export type EnergyAnchorPoint = { x: number; y: number };
export type EnergyFlowKey =
	| 'solarToBattery'
	| 'solarToCar'
	| 'solarToHome'
	| 'solarToGrid'
	| 'gridToHome'
	| 'gridToCar'
	| 'gridToBattery'
	| 'batteryToHome'
	| 'batteryToCar';
export type EnergyFlowWaypoints = Partial<Record<EnergyFlowKey, EnergyAnchorPoint[]>>;
export type EnergyAnchors = {
	solar: EnergyAnchorPoint;
	battery: EnergyAnchorPoint;
	door: EnergyAnchorPoint;
	car: EnergyAnchorPoint;
	street: EnergyAnchorPoint;
	railX: number;
	flowWaypoints?: EnergyFlowWaypoints;
};

export type CameraConfig = {
	entityId: string;
	alias?: string;
	color?: string;
	personEntityId?: string;
	isLarge?: boolean;
	useAdvanced?: boolean;
	advancedConfig?: string;
};

export type CardDraft = {
	id: string;
	title: string;
	cardType: string;
	hiddenInSection?: boolean;
	entityId?: string;
	alarmEntityId?: string;
	solarEntityId?: string;
	batteryEntityId?: string;
	gridEntityId?: string;
	batteryChargeEntityId?: string;
	netEntityId?: string;
	importTodayEntityId?: string;
	exportTodayEntityId?: string;
	solarTodayEntityId?: string;
	homeTodayEntityId?: string;
	costTodayEntityId?: string;
	compensationTodayEntityId?: string;
	selfSufficiencyEntityId?: string;
	carChargingEntityId?: string;
	carCableEntityId?: string;
	carChargingPowerEntityId?: string;
	/** Energy: live-power entities per apparaat (sub-modal "Verbruik per apparaat") */
	energyDeviceEntityIds?: string[];
	/** Energy: optionele kWh-vandaag entities per apparaat, dezelfde volgorde als energyDeviceEntityIds */
	energyDeviceTodayEntityIds?: string[];
	/** Energy: aliassen per device-entity-id (overschrijft friendly_name) */
	energyDeviceAliases?: Record<string, string>;
	/** Energy: kWh snapshot per device-entity-id voor "vandaag" berekening — gereset bij dagwissel */
	energyDeviceSnapshot?: {
		date: string; // YYYY-MM-DD
		values: Record<string, number>; // entityId -> kWh-stand bij dagstart
	};
	hasCustomDayNoCar?: boolean;
	hasCustomDayWithCar?: boolean;
	hasCustomNightNoCar?: boolean;
	hasCustomNightWithCar?: boolean;
	anchorsDayNoCar?: EnergyAnchors;
	anchorsDayWithCar?: EnergyAnchors;
	anchorsNightNoCar?: EnergyAnchors;
	anchorsNightWithCar?: EnergyAnchors;
	analogClockStyle?: 1 | 2 | 3 | 4;
	digitalClockStyle?: 1 | 2 | 3 | 4;
	clockStyle?: ClockStyle;
	clockShowAnalog?: boolean;
	clockShowDigital?: boolean;
	clockHour12?: boolean;
	clockSeconds?: boolean;
	dateLayout?: 'vertical' | 'horizontal';
	dateShortDay?: boolean;
	dateShortMonth?: boolean;
	dateAlign?: 'left' | 'center' | 'right';
	dateWeekdayWithDate?: boolean;
	weatherForecastType?: 'daily' | 'hourly' | 'twice_daily';
	weatherForecastDaysToShow?: number;
	statusDomains?: string[];
	statusDeviceClasses?: string[];
	statusEntityIds?: string[];
	/** Lowercase entity IDs already handled by the scoped picker (legacy cards omit this until migration). */
	statusDiscoveredEntityIds?: string[];
	statusEntityAliases?: Record<string, string>;
	statusEntityIconOverrides?: Record<string, string>;
	statusIcon?: string;
	ignoredEntityIds?: string[];
	/** Camera-strip: lijst van camera's met layout-info en optionele Advanced Camera Card config */
	cameras?: CameraConfig[];
};

export type ViewSectionDraft = {
	id: string;
	title: string;
	icon?: string;
	headerTemperatureEntityId?: string;
	headerHumidityEntityId?: string;
	headerPressureEntityId?: string;
	column: number;
	span: number;
	order: number;
	cardColumns: 1 | 2;
	cards: CardDraft[];
};

export type OAuthConfig = {
	spotifyClientId?: string;
	spotifyClientSecret?: string;
	spotifyRedirectUri?: string;
	tuneInUserId?: string;
};

export type OnkyoBridgeConfig = {
	id: string;
	label: string;
	zoneEntityId: string;
	spotifySource?: string;
};

export type MediaHubConfig = {
	/** Onkyo zones die als virtuele Spotify Connect-targets verschijnen. */
	onkyoBridges?: OnkyoBridgeConfig[];
	/** Aangepaste volgorde van mediaspelers in de Spelers-tab (entity IDs). */
	playerOrder?: string[];
	/** Hernoemingen van mediaspelers (entity ID -> alias). */
	playerAliases?: Record<string, string>;
};

export type PanelConfiguration = {
	language: string;
	cardLibraryTab?: 'sidebar' | 'view';
	titles?: {
		cardLibrary?: string;
		homeviewPreview?: string;
	};
	oauth?: OAuthConfig;
	mediaHub?: MediaHubConfig;
};

export type PanelDashboardLayout = {
	columns: 1 | 2 | 3;
	popupWidth: number;
	popupHeight: number;
};

export type PanelDashboard = {
	layout: PanelDashboardLayout;
	viewSections: ViewSectionDraft[];
	sidebarCards: CardDraft[];
	updatedAt?: number;
};

export type LegacyPanelState = {
	layout?: Partial<PanelDashboardLayout>;
	cards?: CardDraft[];
};
