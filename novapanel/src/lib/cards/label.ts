export function getLocalizedCardLabel(type: string, t: (key: string) => string) {
	if (type === 'clock') return t('cardTypeClock');
	if (type === 'date') return t('cardTypeDate');
	if (type === 'divider') return t('cardTypeDivider');
	if (type === 'home') return t('cardTypeHome');
	if (type === 'scene') return t('cardTypeScene');
	if (type === 'status') return t('cardTypeStatus');
	if (type === 'weather') return t('cardTypeWeather');
	if (type === 'weather_forecast') return t('cardTypeWeatherForecast');
	if (type === 'alarm_panel') return t('cardTypeAlarmPanel');
	if (type === 'lights_status') return t('cardTypeLightsStatus');
	if (type === 'openings_status') return t('cardTypeOpeningsStatus');
	if (type === 'devices_status') return t('cardTypeDevicesStatus');
	if (type === 'availability_status') return t('cardTypeAvailabilityStatus');
	if (type === 'media_players_status') return t('Media Spelers');
	if (type === 'energy') return t('Energieoverzicht');
	if (type === 'cameras_strip') return t("Camera's");
	if (type === 'week_calendar') return t('Weekkalender');
	if (type === 'light_button') return t('Lamp');
	if (type === 'climate_button') return t('Climate');
	if (type === 'cover_button') return t('Gordijn');
	if (type === 'vacuum_button') return t('Stofzuiger');
	if (type === 'media_player_button') return t('Media player');
	if (type === 'lights') return t('cardTypeLights');
	if (type === 'camera') return t('cardTypeCamera');
	if (type === 'media') return t('cardTypeMedia');
	return t('cardTypeCustom');
}
