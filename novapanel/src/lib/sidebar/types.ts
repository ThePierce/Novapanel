export type SidebarItemType = string;

export type EnergyAnchorPoint = { x: number; y: number };
export type EnergyAnchors = {
	solar: EnergyAnchorPoint;
	battery: EnergyAnchorPoint;
	door: EnergyAnchorPoint;
	car: EnergyAnchorPoint;
	street: EnergyAnchorPoint;
	railX: number;
};

export type SidebarItemBase = {
	id: string;
	type: SidebarItemType;
	title: string;
	locale?: string;
	entityId?: string;
	alarmEntityId?: string;
	solarEntityId?: string;
	batteryEntityId?: string;
	gridEntityId?: string;
	batteryChargeEntityId?: string;
	netEntityId?: string;
	// Vandaag-totalen (Utility Meter helpers, kWh)
	importTodayEntityId?: string;
	exportTodayEntityId?: string;
	solarTodayEntityId?: string;
	homeTodayEntityId?: string;
	// Kosten vandaag (EUR, Utility Meter helpers)
	costTodayEntityId?: string;
	compensationTodayEntityId?: string;
	// Optioneel: zelfvoorzienend % als template-sensor bestaat
	selfSufficiencyEntityId?: string;
	// Auto aan de lader (binary_sensor of soortgelijk) en laadvermogen
	carChargingEntityId?: string;
	carCableEntityId?: string;
	carChargingPowerEntityId?: string;
	// Per-scenario flags voor eigen geüploade foto's
	hasCustomDayNoCar?: boolean;
	hasCustomDayWithCar?: boolean;
	hasCustomNightNoCar?: boolean;
	hasCustomNightWithCar?: boolean;
	// Per-scenario ankerpunten (genormaliseerd 0..1)
	anchorsDayNoCar?: EnergyAnchors;
	anchorsDayWithCar?: EnergyAnchors;
	anchorsNightNoCar?: EnergyAnchors;
	anchorsNightWithCar?: EnergyAnchors;
	statusDomains?: string[];
	statusDeviceClasses?: string[];
	statusEntityIds?: string[];
	statusEntityAliases?: Record<string, string>;
	statusEntityIconOverrides?: Record<string, string>;
	statusIcon?: string;
	ignoredEntityIds?: string[];
	cameras?: import('$lib/persistence/panel-state-types').CameraConfig[];
	analogClockStyle?: 1 | 2 | 3 | 4;
	digitalClockStyle?: 1 | 2 | 3 | 4;
	clockStyle?: string;
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
	visible: boolean;
	order: number;
};

export type SidebarState = {
	enabled: boolean;
	width: number;
	items: SidebarItemBase[];
};
