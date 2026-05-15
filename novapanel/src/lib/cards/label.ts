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
	if (type === 'media_players_status') return 'Media spelers';
	if (type === 'energy') return 'Energieoverzicht';
	if (type === 'cameras_strip') return "Camera's";
	if (type === 'week_calendar') return 'Weekkalender';
	if (type === 'light_button') return 'Lamp';
	if (type === 'climate_button') return 'Climate';
	if (type === 'cover_button') return 'Gordijn';
	if (type === 'vacuum_button') return 'Robotstofzuiger';
	if (type === 'media_player_button') return 'Media player';
	if (type === 'lights') return t('cardTypeLights');
	if (type === 'camera') return t('cardTypeCamera');
	if (type === 'media') return t('cardTypeMedia');
	return t('cardTypeCustom');
}
