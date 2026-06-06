import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { languageOptions, translations, type LanguageCode, type TranslationKey } from './i18n-data';

export { languageOptions, translations };
export type { LanguageCode, TranslationKey };

const DEFAULT_LANGUAGE: LanguageCode = 'en';
const STORAGE_KEY = 'novapanel.language';

function initialSelectedLanguage(fallback: LanguageCode = 'nl'): LanguageCode {
	if (!browser) return fallback;
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		return typeof saved === 'string' && saved in translations ? (saved as LanguageCode) : fallback;
	} catch {
		return fallback;
	}
}

export const selectedLanguageStore = writable<LanguageCode>(initialSelectedLanguage());

const phraseTranslationsBase: Record<string, Partial<Record<LanguageCode, string>>> = {
	Lamp: { en: 'Light', de: 'Licht', fr: 'Lumière', es: 'Luz' },
	Lampen: { en: 'Lights', de: 'Lichter', fr: 'Lumières', es: 'Luces' },
	Gordijn: { en: 'Cover', de: 'Abdeckung', fr: 'Volet', es: 'Persiana' },
	Stofzuiger: { en: 'Vacuum', de: 'Staubsauger', fr: 'Aspirateur', es: 'Aspiradora' },
	'Media player': {
		en: 'Media player',
		de: 'Mediaplayer',
		fr: 'Lecteur multimédia',
		es: 'Reproductor multimedia'
	},
	Apparaat: { en: 'Device', de: 'Gerät', fr: 'Appareil', es: 'Dispositivo' },
	Apparaten: { en: 'Devices', de: 'Geräte', fr: 'Appareils', es: 'Dispositivos' },
	'Media Spelers': {
		en: 'Media players',
		de: 'Mediaplayer',
		fr: 'Lecteurs multimédia',
		es: 'Reproductores multimedia'
	},
	Overig: { en: 'Other', de: 'Sonstiges', fr: 'Autre', es: 'Otros' },
	Aan: { en: 'On', de: 'Ein', fr: 'Allumé', es: 'Encendido' },
	Uit: { en: 'Off', de: 'Aus', fr: 'Éteint', es: 'Apagado' },
	Uitgeschakeld: { en: 'Disarmed', de: 'Deaktiviert', fr: 'Désarmé', es: 'Desactivado' },
	'Wordt ingeschakeld…': { en: 'Arming…', de: 'Wird aktiviert…', fr: 'Armement…', es: 'Activando…' },
	'In afwachting': { en: 'Pending', de: 'Ausstehend', fr: 'En attente', es: 'Pendiente' },
	Ingeschakeld: { en: 'Armed', de: 'Aktiviert', fr: 'Armé', es: 'Activado' },
	'ALARM!': { en: 'ALARM!', de: 'ALARM!', fr: 'ALARME !', es: '¡ALARMA!' },
	Uitschakelen: { en: 'Disarm', de: 'Deaktivieren', fr: 'Désarmer', es: 'Desactivar' },
	Wis: { en: 'Clear', de: 'Löschen', fr: 'Effacer', es: 'Borrar' },
	Weg: { en: 'Away', de: 'Abwesend', fr: 'Absent', es: 'Fuera' },
	Nacht: { en: 'Night', de: 'Nacht', fr: 'Nuit', es: 'Noche' },
	Open: { en: 'Open', de: 'Offen', fr: 'Ouvert', es: 'Abierto' },
	Dicht: { en: 'Closed', de: 'Geschlossen', fr: 'Fermé', es: 'Cerrado' },
	Opent: { en: 'Opening', de: 'Öffnet', fr: 'Ouverture', es: 'Abriendo' },
	Sluit: { en: 'Closing', de: 'Schließt', fr: 'Fermeture', es: 'Cerrando' },
	Speelt: { en: 'Playing', de: 'Wiedergabe', fr: 'Lecture', es: 'Reproduciendo' },
	Gepauzeerd: { en: 'Paused', de: 'Pausiert', fr: 'En pause', es: 'Pausado' },
	Schoonmaken: { en: 'Cleaning', de: 'Reinigt', fr: 'Nettoyage', es: 'Limpiando' },
	'Terug naar dock': {
		en: 'Returning to dock',
		de: 'Zurück zur Basis',
		fr: 'Retour à la base',
		es: 'Volviendo a la base'
	},
	Onbekend: { en: 'Unknown', de: 'Unbekannt', fr: 'Inconnu', es: 'Desconocido' },
	'Niet beschikbaar': { en: 'Unavailable', de: 'Nicht verfügbar', fr: 'Indisponible', es: 'No disponible' },
	'Geen data': { en: 'No data', de: 'Keine Daten', fr: 'Aucune donnée', es: 'Sin datos' },
	'Geen lamp gekoppeld': {
		en: 'No light linked',
		de: 'Kein Licht verknüpft',
		fr: 'Aucune lumière liée',
		es: 'Ninguna luz vinculada'
	},
	'Geen entiteit gekoppeld': {
		en: 'No entity linked',
		de: 'Keine Entität verknüpft',
		fr: 'Aucune entité liée',
		es: 'Ninguna entidad vinculada'
	},
	'Geen entiteit ingesteld': {
		en: 'No entity configured',
		de: 'Keine Entität konfiguriert',
		fr: 'Aucune entité configurée',
		es: 'Ninguna entidad configurada'
	},
	'Sensor geeft geen getal': { en: 'Sensor is not numeric' },
	'Niet gevonden': { en: 'Not found', de: 'Nicht gefunden', fr: 'Introuvable', es: 'No encontrado' },
	Energie: { en: 'Energy', de: 'Energie', fr: 'Énergie', es: 'Energía' },
	Energieoverzicht: { en: 'Energy overview' },
	Opwek: { en: 'Production', de: 'Erzeugung', fr: 'Production', es: 'Producción' },
	Zelfvoorzienend: { en: 'Self-sufficient', de: 'Autark', fr: 'Autosuffisant', es: 'Autosuficiente' },
	Net: { en: 'Grid', de: 'Netz', fr: 'Réseau', es: 'Red' },
	Kosten: { en: 'Costs', de: 'Kosten', fr: 'Coûts', es: 'Costes' },
	Kostenmodus: { en: 'Cost mode', de: 'Kostenmodus', fr: 'Mode de coût', es: 'Modo de costes' },
	Teruglevering: { en: 'Export', de: 'Einspeisung', fr: 'Retour réseau', es: 'Exportación' },
	'Teruglevering piek': {
		en: 'Export peak',
		de: 'Einspeisung Hochtarif',
		fr: 'Revente heures pleines',
		es: 'Exportación punta'
	},
	'Teruglevering dal': {
		en: 'Export off-peak',
		de: 'Einspeisung Niedertarif',
		fr: 'Revente heures creuses',
		es: 'Exportación valle'
	},
	Afname: { en: 'Import', de: 'Bezug', fr: 'Prélèvement', es: 'Importación' },
	'Vast piek/dal': {
		en: 'Fixed peak/off-peak',
		de: 'Fester Hoch-/Niedertarif',
		fr: 'Heures pleines/creuses fixes',
		es: 'Punta/valle fijo'
	},
	'Exacte sensoren': {
		en: 'Exact sensors',
		de: 'Exakte Sensoren',
		fr: 'Capteurs exacts',
		es: 'Sensores exactos'
	},
	'Gebruik cumulatieve euro-sensoren voor de werkelijke kosten en vergoeding van vandaag.': {
		en: "Use cumulative currency sensors for today's actual costs and compensation.",
		de: 'Verwende kumulative Währungssensoren für die tatsächlichen Kosten und Vergütung heute.',
		fr: 'Utilisez des capteurs monétaires cumulatifs pour les coûts et la compensation réels du jour.',
		es: 'Usa sensores monetarios acumulativos para los costes y la compensación reales de hoy.'
	},
	'Voor een vast contract: koppel de piek- en dal-kWh-tellers en vul de vaste tarieven per kWh in.': {
		en: 'For a fixed contract: link the peak/off-peak kWh meters and enter the fixed rates per kWh.',
		de: 'Für einen festen Vertrag: verknüpfe die Hoch-/Niedertarif-kWh-Zähler und trage die festen Tarife pro kWh ein.',
		fr: 'Pour un contrat fixe : liez les compteurs kWh heures pleines/creuses et saisissez les tarifs fixes par kWh.',
		es: 'Para un contrato fijo: vincula los contadores kWh punta/valle e introduce las tarifas fijas por kWh.'
	},
	'Afname piek tarief': {
		en: 'Import peak tariff',
		de: 'Bezug Hochtarif',
		fr: "Tarif d'import heures pleines",
		es: 'Tarifa importación punta'
	},
	'Afname dal tarief': {
		en: 'Import off-peak tariff',
		de: 'Bezug Niedertarif',
		fr: "Tarif d'import heures creuses",
		es: 'Tarifa importación valle'
	},
	'Teruglever piek tarief': {
		en: 'Export peak tariff',
		de: 'Einspeisetarif Hochtarif',
		fr: 'Tarif de revente heures pleines',
		es: 'Tarifa exportación punta'
	},
	'Teruglever dal tarief': {
		en: 'Export off-peak tariff',
		de: 'Einspeisetarif Niedertarif',
		fr: 'Tarif de revente heures creuses',
		es: 'Tarifa exportación valle'
	},
	'Teruglever tarief enkel': {
		en: 'Single export tariff',
		de: 'Einheitlicher Einspeisetarif',
		fr: 'Tarif de revente unique',
		es: 'Tarifa de exportación única'
	},
	'Met alleen actuele tariefsensors is het dagbedrag een schatting. Gebruik exacte euro-sensoren voor werkelijke dynamische kosten.':
		{
			en: 'With only current tariff sensors, the daily amount is an estimate. Use exact currency sensors for actual dynamic costs.',
			de: 'Mit nur aktuellen Tarifsensoren ist der Tagesbetrag eine Schätzung. Verwende exakte Währungssensoren für tatsächliche dynamische Kosten.',
			fr: 'Avec seulement des capteurs de tarif actuels, le montant du jour est une estimation. Utilisez des capteurs monétaires exacts pour les coûts dynamiques réels.',
			es: 'Con solo sensores de tarifa actual, el importe diario es una estimación. Usa sensores monetarios exactos para costes dinámicos reales.'
		},
	schatting: { en: 'estimate', de: 'Schätzung', fr: 'estimation', es: 'estimación' },
	'In balans': { en: 'Balanced', de: 'Ausgeglichen', fr: 'Équilibré', es: 'En equilibrio' },
	'Bekijk verbruik per apparaat': { en: 'View consumption per device' },
	'Verbruik per apparaat': { en: 'Consumption per device' },
	Live: { en: 'Live', de: 'Live', fr: 'Live', es: 'En vivo' },
	vandaag: { en: 'today', de: 'heute', fr: 'aujourd’hui', es: 'hoy' },
	'Live verbruik': { en: 'Live consumption' },
	'apparaten actief': { en: 'devices active' },
	'sinds 00:00': { en: 'since 00:00' },
	'Huidig verbruik': { en: 'Current consumption' },
	'Geen apparaten geconfigureerd.': { en: 'No devices configured.' },
	'Alle apparaten verborgen — klik er hieronder eentje aan.': { en: 'All devices hidden — click one below.' },
	terug: { en: 'export', de: 'Einspeisung', fr: 'retour', es: 'exportación' },
	'Geen verbruik': {
		en: 'No consumption',
		de: 'Kein Verbrauch',
		fr: 'Aucune consommation',
		es: 'Sin consumo'
	},
	Valuta: { en: 'Currency', de: 'Währung', fr: 'Devise', es: 'Moneda' },
	afname: { en: 'import', de: 'Bezug', fr: 'prélèvement', es: 'importación' },
	'lamp aan': { en: 'light on' },
	'lampen aan': { en: 'lights on' },
	'Alle lampen uit': { en: 'All lights off' },
	'van totaal': { en: 'of total' },
	'Alles dicht': { en: 'Everything closed' },
	'apparaat actief': { en: 'device active' },
	'Alle apparaten uit': { en: 'All devices off' },
	'Niet bereikbaar': { en: 'Unreachable' },
	Afspelen: { en: 'Playing' },
	Inactief: { en: 'Idle' },
	Verwarmen: { en: 'Heating' },
	Koelen: { en: 'Cooling' },
	Gesloten: { en: 'Closed' },
	'Actie mislukt': {
		en: 'Action failed',
		de: 'Aktion fehlgeschlagen',
		fr: 'Action échouée',
		es: 'Acción fallida'
	},
	Helderheid: { en: 'Brightness', de: 'Helligkeit', fr: 'Luminosité', es: 'Brillo' },
	procent: { en: 'percent', de: 'Prozent', fr: 'pour cent', es: 'por ciento' },
	uitzetten: { en: 'turn off', de: 'ausschalten', fr: 'éteindre', es: 'apagar' },
	aanzetten: { en: 'turn on', de: 'einschalten', fr: 'allumer', es: 'encender' },
	Kleuren: { en: 'Colors', de: 'Farben', fr: 'Couleurs', es: 'Colores' },
	'Warm wit': { en: 'Warm white', de: 'Warmweiß', fr: 'Blanc chaud', es: 'Blanco cálido' },
	'Zacht warm': { en: 'Soft warm', de: 'Weich warm', fr: 'Chaud doux', es: 'Cálido suave' },
	Oranje: { en: 'Orange', de: 'Orange', fr: 'Orange', es: 'Naranja' },
	Paars: { en: 'Purple', de: 'Lila', fr: 'Violet', es: 'Morado' },
	'Helder wit': { en: 'Bright white', de: 'Helles Weiß', fr: 'Blanc lumineux', es: 'Blanco brillante' },
	Wittemperatuur: {
		en: 'White temperature',
		de: 'Weißtemperatur',
		fr: 'Température du blanc',
		es: 'Temperatura de blanco'
	},
	Warm: { en: 'Warm', de: 'Warm', fr: 'Chaud', es: 'Cálido' },
	Neutraal: { en: 'Neutral', de: 'Neutral', fr: 'Neutre', es: 'Neutro' },
	Koel: { en: 'Cool', de: 'Kühl', fr: 'Froid', es: 'Frío' },
	Climate: { en: 'Climate', de: 'Klima', fr: 'Climat', es: 'Clima' },
	Doel: { en: 'Target', de: 'Ziel', fr: 'Cible', es: 'Objetivo' },
	doel: { en: 'target', de: 'Ziel', fr: 'cible', es: 'objetivo' },
	Nu: { en: 'Now', de: 'Jetzt', fr: 'Maintenant', es: 'Ahora' },
	Doeltemperatuur: {
		en: 'Target temperature',
		de: 'Zieltemperatur',
		fr: 'Température cible',
		es: 'Temperatura objetivo'
	},
	'Geen doeltemperatuur beschikbaar': {
		en: 'No target temperature available',
		de: 'Keine Zieltemperatur verfügbar',
		fr: 'Aucune température cible disponible',
		es: 'No hay temperatura objetivo disponible'
	},
	Modus: { en: 'Mode', de: 'Modus', fr: 'Mode', es: 'Modo' },
	Preset: { en: 'Preset', de: 'Preset', fr: 'Préréglage', es: 'Preajuste' },
	'Geen preset': { en: 'No preset', de: 'Kein Preset', fr: 'Aucun préréglage', es: 'Sin preajuste' },
	Status: { en: 'Status', de: 'Status', fr: 'Statut', es: 'Estado' },
	Batterij: { en: 'Battery', de: 'Batterie', fr: 'Batterie', es: 'Batería' },
	Pauze: { en: 'Pause', de: 'Pause', fr: 'Pause', es: 'Pausa' },
	Dock: { en: 'Dock', de: 'Dock', fr: 'Base', es: 'Base' },
	Zoek: { en: 'Find', de: 'Suchen', fr: 'Trouver', es: 'Buscar' },
	Zuigkracht: { en: 'Suction power', de: 'Saugkraft', fr: 'Puissance', es: 'Potencia' },
	Vorige: { en: 'Previous', de: 'Zurück', fr: 'Précédent', es: 'Anterior' },
	Volgende: { en: 'Next', de: 'Weiter', fr: 'Suivant', es: 'Siguiente' },
	Pauzeren: { en: 'Pause', de: 'Pausieren', fr: 'Pause', es: 'Pausar' },
	'Aan/uit': { en: 'Power', de: 'Ein/Aus', fr: 'Marche/arrêt', es: 'Encendido/apagado' },
	Actief: { en: 'Active', de: 'Aktiv', fr: 'Actif', es: 'Activo' },
	'Afspelen of pauzeren': {
		en: 'Play or pause',
		de: 'Abspielen oder pausieren',
		fr: 'Lire ou pause',
		es: 'Reproducir o pausar'
	},
	Bron: { en: 'Source', de: 'Quelle', fr: 'Source', es: 'Fuente' },
	'Geen kaarten in deze sectie': {
		en: 'No cards in this section',
		de: 'Keine Karten in diesem Abschnitt',
		fr: 'Aucune carte dans cette section',
		es: 'No hay tarjetas en esta sección'
	},
	'Kies een entiteit': {
		en: 'Choose an entity',
		de: 'Entität wählen',
		fr: 'Choisir une entité',
		es: 'Elegir entidad'
	},
	'Apparaat entiteit': {
		en: 'Device entity',
		de: 'Geräteentität',
		fr: 'Entité appareil',
		es: 'Entidad de dispositivo'
	},
	'Apparaatknop met aan/uit bediening': { en: 'Device button with on/off control' },
	Domein: { en: 'Domain', de: 'Domäne', fr: 'Domaine', es: 'Dominio' },
	'Kies een lamp': { en: 'Choose a light', de: 'Licht wählen', fr: 'Choisir une lumière', es: 'Elegir luz' },
	'Zoek in entiteiten...': {
		en: 'Search entities...',
		de: 'Entitäten suchen...',
		fr: 'Rechercher des entités...',
		es: 'Buscar entidades...'
	},
	'Zoekterm wissen': {
		en: 'Clear search',
		de: 'Suche löschen',
		fr: 'Effacer la recherche',
		es: 'Borrar búsqueda'
	},
	'Wis zoekopdracht': {
		en: 'Clear search',
		de: 'Suche löschen',
		fr: 'Effacer la recherche',
		es: 'Borrar búsqueda'
	},
	'Geen entiteiten gevonden voor je zoekopdracht.': { en: 'No entities found for your search.' },
	'Geen entiteiten beschikbaar.': { en: 'No entities available.' },
	'Geen kamer toegewezen': { en: 'No room assigned' },
	'Kamerinformatie laden…': { en: 'Loading room information…' },
	actief: { en: 'active', de: 'aktiv', fr: 'actif', es: 'activo' },
	van: { en: 'of', de: 'von', fr: 'sur', es: 'de' },
	gevonden: { en: 'found', de: 'gefunden', fr: 'trouvés', es: 'encontrados' },
	geen: { en: 'none', de: 'keine', fr: 'aucun', es: 'ninguno' },
	'alles aan': { en: 'select all', de: 'alle auswählen', fr: 'tout sélectionner', es: 'seleccionar todo' },
	geselecteerd: { en: 'selected', de: 'ausgewählt', fr: 'sélectionné', es: 'seleccionado' },
	alle: { en: 'all', de: 'alle', fr: 'tous', es: 'todos' },
	wissen: { en: 'clear', de: 'löschen', fr: 'effacer', es: 'borrar' },
	'Lamp entiteit': { en: 'Light entity' },
	'Climate entiteit': { en: 'Climate entity' },
	'Cover entiteit': { en: 'Cover entity' },
	'Vacuum entiteit': { en: 'Vacuum entity' },
	'Media player entiteit': { en: 'Media player entity' },
	'MDI icoon': { en: 'MDI icon', de: 'MDI-Symbol', fr: 'Icône MDI', es: 'Icono MDI' },
	'Gebruik een Material Design Icon naam, bijvoorbeeld': {
		en: 'Use a Material Design Icon name, for example'
	},
	'Sla de kaart daarna op.': { en: 'Then save the card.' },
	'Popup icoon': { en: 'Popup icon', de: 'Popup-Symbol', fr: 'Icône de popup', es: 'Icono de popup' },
	'Header waarden': {
		en: 'Header metrics',
		de: 'Header-Werte',
		fr: 'Valeurs d’en-tête',
		es: 'Métricas de cabecera'
	},
	Temperatuur: { en: 'Temperature', de: 'Temperatur', fr: 'Température', es: 'Temperatura' },
	Luchtvochtigheid: { en: 'Humidity', de: 'Luftfeuchtigkeit', fr: 'Humidité', es: 'Humedad' },
	Luchtdruk: { en: 'Pressure', de: 'Luftdruck', fr: 'Pression', es: 'Presión' },
	'Geen temperatuur': {
		en: 'No temperature',
		de: 'Keine Temperatur',
		fr: 'Aucune température',
		es: 'Sin temperatura'
	},
	'Geen luchtvochtigheid': {
		en: 'No humidity',
		de: 'Keine Luftfeuchtigkeit',
		fr: 'Aucune humidité',
		es: 'Sin humedad'
	},
	'Geen luchtdruk': { en: 'No pressure', de: 'Kein Luftdruck', fr: 'Aucune pression', es: 'Sin presión' },
	'Kaarten zichtbaar in sectie': {
		en: 'Cards visible in section',
		de: 'Sichtbare Karten im Abschnitt',
		fr: 'Cartes visibles dans la section',
		es: 'Tarjetas visibles en la sección'
	},
	Weekkalender: {
		en: 'Week calendar',
		de: 'Wochenkalender',
		fr: 'Calendrier semaine',
		es: 'Calendario semanal'
	},
	Kalenders: { en: 'Calendars', de: 'Kalender', fr: 'Calendriers', es: 'Calendarios' },
	'Kies CalDAV kalender-entiteiten, koppel optioneel een person-entiteit, geef iedere persoon een kleur en zet ze in de juiste volgorde.':
		{
			en: 'Choose CalDAV calendar entities, optionally link a person entity, give each person a color, and set the order.'
		},
	'Persoon toevoegen': {
		en: 'Add person',
		de: 'Person hinzufügen',
		fr: 'Ajouter une personne',
		es: 'Añadir persona'
	},
	'Nog geen kalenders geselecteerd. Je kunt ook handmatig een entity id invullen, bijvoorbeeld': {
		en: 'No calendars selected yet. You can also enter an entity ID manually, for example'
	},
	Naam: { en: 'Name', de: 'Name', fr: 'Nom', es: 'Nombre' },
	Kleur: { en: 'Color', de: 'Farbe', fr: 'Couleur', es: 'Color' },
	'Volgorde aanpassen': {
		en: 'Adjust order',
		de: 'Reihenfolge anpassen',
		fr: 'Ajuster l’ordre',
		es: 'Ajustar orden'
	},
	Omhoog: { en: 'Move up', de: 'Nach oben', fr: 'Monter', es: 'Subir' },
	Omlaag: { en: 'Move down', de: 'Nach unten', fr: 'Descendre', es: 'Bajar' },
	Verwijderen: { en: 'Delete', de: 'Löschen', fr: 'Supprimer', es: 'Eliminar' },
	'Kies kalender-entiteiten in edit mode.': {
		en: 'Choose calendar entities in edit mode.',
		de: 'Kalender-Entitäten im Bearbeitungsmodus wählen.',
		fr: 'Choisissez les entités calendrier en mode édition.',
		es: 'Elige entidades de calendario en modo edición.'
	},
	'Hele dag': { en: 'All day', de: 'Ganztägig', fr: 'Toute la journée', es: 'Todo el día' },
	Afspraak: { en: 'Event', de: 'Termin', fr: 'Événement', es: 'Evento' },
	events: { nl: 'afspraken', en: 'events', de: 'Termine', fr: 'événements', es: 'eventos' },
	'Kalender laden...': {
		en: 'Loading calendar...',
		de: 'Kalender wird geladen...',
		fr: 'Chargement du calendrier...',
		es: 'Cargando calendario...'
	},
	'Kalender laden mislukt': {
		en: 'Calendar failed to load',
		de: 'Kalender konnte nicht geladen werden',
		fr: 'Échec du chargement du calendrier',
		es: 'No se pudo cargar el calendario'
	},
	'Component kon niet worden geladen.': {
		en: 'Component could not be loaded.',
		de: 'Komponente konnte nicht geladen werden.',
		fr: 'Le composant n’a pas pu être chargé.',
		es: 'No se pudo cargar el componente.'
	},
	'Locatie van': { en: 'Location of', de: 'Standort von', fr: 'Position de', es: 'Ubicación de' },
	'Locatie van iedereen': {
		en: 'Everyone’s location',
		de: 'Standort aller Personen',
		fr: 'Position de tout le monde',
		es: 'Ubicación de todos'
	},
	'Locatie onbekend': {
		en: 'Location unknown',
		de: 'Standort unbekannt',
		fr: 'Position inconnue',
		es: 'Ubicación desconocida'
	},
	Thuis: { en: 'Home', de: 'Zuhause', fr: 'Maison', es: 'Casa' },
	'Niet thuis': { en: 'Away', de: 'Nicht zuhause', fr: 'Absent', es: 'Fuera' },
	'Geen locatie beschikbaar. Koppel een person-entiteit of controleer de locatie-attributen.': {
		en: 'No location available. Link a person entity or check the location attributes.',
		de: 'Kein Standort verfügbar. Verknüpfe eine Personen-Entität oder prüfe die Standortattribute.',
		fr: 'Aucune position disponible. Liez une entité person ou vérifiez les attributs de localisation.',
		es: 'No hay ubicación disponible. Vincula una entidad person o comprueba los atributos de ubicación.'
	},
	'met de auto naar huis': {
		en: 'by car to home',
		de: 'mit dem Auto nach Hause',
		fr: 'en voiture vers la maison',
		es: 'en coche a casa'
	},
	'met de fiets naar huis': {
		en: 'by bike to home',
		de: 'mit dem Fahrrad nach Hause',
		fr: 'à vélo vers la maison',
		es: 'en bici a casa'
	},
	'Sectie waarden': {
		en: 'Section metrics',
		de: 'Abschnittswerte',
		fr: 'Valeurs de section',
		es: 'Métricas de sección'
	},
	'Maak kleiner': { en: 'Collapse', de: 'Verkleinern', fr: 'Réduire', es: 'Reducir' },
	'Maak groter': { en: 'Expand', de: 'Vergrößern', fr: 'Agrandir', es: 'Ampliar' },
	'Personaliseer Novapanel': {
		en: 'Personalize Novapanel',
		de: 'Novapanel personalisieren',
		fr: 'Personnaliser Novapanel',
		es: 'Personalizar Novapanel'
	},
	'Welkom bij': { en: 'Welcome to', de: 'Willkommen bei', fr: 'Bienvenue dans', es: 'Bienvenido a' },
	'Begin met een leeg dashboard en voeg zelf secties, kaarten en Home Assistant-entiteiten toe.': {
		en: 'Start with an empty dashboard and add your own sections, cards, and Home Assistant entities.',
		de: 'Starte mit einem leeren Dashboard und füge eigene Abschnitte, Karten und Home-Assistant-Entitäten hinzu.',
		fr: 'Commencez avec un tableau de bord vide et ajoutez vos sections, cartes et entités Home Assistant.',
		es: 'Empieza con un panel vacío y añade tus propias secciones, tarjetas y entidades de Home Assistant.'
	},
	'Kon Spotify-auth niet starten. Controleer de credentials en redirect URI.': {
		en: 'Could not start Spotify authentication. Check the credentials and redirect URI.',
		de: 'Spotify-Authentifizierung konnte nicht gestartet werden. Prüfe Zugangsdaten und Redirect-URI.',
		fr: 'Impossible de lancer l’authentification Spotify. Vérifiez les identifiants et l’URI de redirection.',
		es: 'No se pudo iniciar la autenticación de Spotify. Comprueba las credenciales y la URI de redirección.'
	},
	'Geen auth-URL ontvangen van de server.': {
		en: 'No auth URL received from the server.',
		de: 'Keine Auth-URL vom Server erhalten.',
		fr: 'Aucune URL d’authentification reçue du serveur.',
		es: 'No se recibió URL de autenticación del servidor.'
	},
	'Pop-up geblokkeerd door de browser. Sta pop-ups toe of probeer opnieuw.': {
		en: 'Popup blocked by the browser. Allow popups or try again.',
		de: 'Popup vom Browser blockiert. Popups erlauben oder erneut versuchen.',
		fr: 'Popup bloquée par le navigateur. Autorisez les popups ou réessayez.',
		es: 'El navegador bloqueó la ventana emergente. Permite popups o inténtalo de nuevo.'
	},
	'Pop-up geblokkeerd door de browser. Sta pop-ups toe voor deze site en probeer opnieuw.': {
		en: 'Popup blocked by the browser. Allow popups for this site and try again.',
		de: 'Popup vom Browser blockiert. Erlaube Popups für diese Seite und versuche es erneut.',
		fr: 'Popup bloquée par le navigateur. Autorisez les popups pour ce site et réessayez.',
		es: 'El navegador bloqueó la ventana emergente. Permite popups para este sitio e inténtalo de nuevo.'
	},
	'Deze redirect gebruikt nog de oude /local_novapanel-route. Novapanel vervangt dit bij verbinden automatisch door de callback-URL hieronder, maar plak die nieuwe URL ook in het Spotify Dashboard.':
		{
			en: 'This redirect still uses the old /local_novapanel route. Novapanel replaces it with the callback URL below when connecting, but also paste that new URL into the Spotify Dashboard.'
		},
	'Maak een gratis app aan op': {
		en: 'Create a free app at',
		de: 'Erstelle eine kostenlose App unter',
		fr: 'Créez une app gratuite sur',
		es: 'Crea una app gratuita en'
	},
	'Klik op Create app, vul een naam en omschrijving in, voeg de callback-URL hieronder toe bij Redirect URI, vink Web API aan en accepteer de voorwaarden. Kopieer daarna de Client ID uit het app-overzicht hierheen.':
		{
			en: 'Click Create app, enter a name and description, add the callback URL below under Redirect URI, select Web API, and accept the terms. Then copy the Client ID from the app overview into this field.'
		},
	'Open je app in het dashboard, klik op Settings en daarna op View client secret. Kopieer de Client Secret hierheen.':
		{
			en: 'Open your app in the dashboard, click Settings, then View client secret. Copy the Client Secret into this field.'
		},
	'Open je app op': {
		en: 'Open your app at',
		de: 'Öffne deine App unter',
		fr: 'Ouvrez votre app sur',
		es: 'Abre tu app en'
	},
	'open Settings en plak exact deze callback-URL bij Redirect URIs:': {
		en: 'open Settings and paste this exact callback URL under Redirect URIs:'
	},
	'Spotify vereist een exacte match en meestal HTTPS. Gebruik precies de URL hierboven; bij Home Assistant ingress hoort daar meestal':
		{
			en: 'Spotify requires an exact match and usually HTTPS. Use exactly the URL above; with Home Assistant ingress it usually should include'
		},
	'in te staan. Als Home Assistant later een andere ingress-token toont, kopieer dan de nieuwe callback-URL opnieuw naar Spotify.':
		{
			en: 'in it. If Home Assistant later shows a different ingress token, copy the new callback URL to Spotify again.'
		},
	'Klik daarna op Add en Save. Laat dit veld leeg om de automatisch herkende callback-URL te gebruiken.': {
		en: 'Then click Add and Save. Leave this field empty to use the automatically detected callback URL.'
	},
	Gekopieerd: { en: 'Copied', de: 'Kopiert', fr: 'Copié', es: 'Copiado' },
	'Kopieer mijn callback-URL': {
		en: 'Copy my callback URL',
		de: 'Callback-URL kopieren',
		fr: 'Copier mon URL de callback',
		es: 'Copiar mi URL de callback'
	},
	'Bezig met verbinden…': { en: 'Connecting…', de: 'Verbinden…', fr: 'Connexion…', es: 'Conectando…' },
	'Status controleren': {
		en: 'Check status',
		de: 'Status prüfen',
		fr: 'Vérifier le statut',
		es: 'Comprobar estado'
	},
	'Voltooi de Spotify-koppeling in het nieuw geopende tabblad. Dit venster pikt het automatisch op.': {
		en: 'Complete the Spotify connection in the newly opened tab. This window will pick it up automatically.'
	},
	'Thema-opties komen binnenkort': {
		en: 'Theme options are coming soon',
		de: 'Theme-Optionen folgen demnächst',
		fr: 'Les options de thème arrivent bientôt',
		es: 'Las opciones de tema llegarán pronto'
	},
	"Camera's": { en: 'Cameras', de: 'Kameras', fr: 'Caméras', es: 'Cámaras' },
	"geen camera's": { en: 'no cameras' },
	groot: { en: 'large', de: 'groß', fr: 'grand', es: 'grande' },
	'Voeg camera-entiteiten toe en bepaal welke groot worden weergegeven (Apple Home stijl). Zet Advanced Camera Card aan voor de HA custom-card; extra YAML is optioneel.':
		{
			en: 'Add camera entities and choose which ones are shown large (Apple Home style). Enable Advanced Camera Card for the HA custom card; extra YAML is optional.'
		},
	"Nog geen camera's geselecteerd.": { en: 'No cameras selected yet.' },
	'Naam (optioneel)': {
		en: 'Name (optional)',
		de: 'Name (optional)',
		fr: 'Nom (facultatif)',
		es: 'Nombre (opcional)'
	},
	optioneel: { en: 'optional', de: 'optional', fr: 'facultatif', es: 'opcional' },
	'Groot weergeven': { en: 'Show large', de: 'Groß anzeigen', fr: 'Afficher en grand', es: 'Mostrar grande' },
	'Camera toevoegen': {
		en: 'Add camera',
		de: 'Kamera hinzufügen',
		fr: 'Ajouter une caméra',
		es: 'Añadir cámara'
	},
	'Alle camera-entiteiten zijn al toegevoegd.': { en: 'All camera entities have already been added.' },
	'Geen camera-entiteiten gevonden.': { en: 'No camera entities found.' },
	"Geen camera's geconfigureerd": { en: 'No cameras configured' },
	'Advanced Camera Card kon niet worden geladen. Ik toon de normale cameraview.': {
		en: 'Advanced Camera Card could not be loaded. Showing the normal camera view.'
	},
	'Geen beeld beschikbaar': { en: 'No image available' },
	Voorspelling: { en: 'Forecast', de: 'Vorhersage', fr: 'Prévisions', es: 'Pronóstico' },
	'Welk type voorspelling en hoeveel dagen er getoond worden.': {
		en: 'Which forecast type and how many days are shown.'
	},
	Dagen: { en: 'Days', de: 'Tage', fr: 'Jours', es: 'Días' },
	'Voorspelling voor de komende dagen': { en: 'Forecast for the coming days' },
	'Voorspelling laden…': { en: 'Loading forecast…' },
	Uurlijks: { en: 'Hourly', de: 'Stündlich', fr: 'Horaire', es: 'Por hora' },
	'Uurvoorspelling laden…': { en: 'Loading hourly forecast…' },
	Vandaag: { en: 'Today', de: 'Heute', fr: 'Aujourd’hui', es: 'Hoy' },
	'Vandaag-totalen': { en: 'Today totals' },
	'optioneel; anders berekend': { en: 'optional; otherwise calculated' },
	Morgen: { en: 'Tomorrow', de: 'Morgen', fr: 'Demain', es: 'Mañana' },
	Totaal: { en: 'Total', de: 'Gesamt', fr: 'Total', es: 'Total' },
	Lampengroepen: { en: 'Light groups', de: 'Lichtgruppen', fr: 'Groupes de lumières', es: 'Grupos de luces' },
	'Groepen tellen als 1 item in het overzicht. Handig om "Woonkamer" als één entiteit te zien.': {
		en: 'Groups count as one item in the overview. Useful for showing “Living room” as a single entity.'
	},
	Bewerken: { en: 'Edit', de: 'Bearbeiten', fr: 'Modifier', es: 'Editar' },
	'Nog geen lampen toegevoegd': { en: 'No lights added yet' },
	meer: { en: 'more', de: 'mehr', fr: 'plus', es: 'más' },
	'Nieuwe groepsnaam': { en: 'New group name' },
	Toevoegen: { en: 'Add', de: 'Hinzufügen', fr: 'Ajouter', es: 'Añadir' },
	'Bewerk hoe deze kaart leest en weergeeft': { en: 'Edit how this card reads and displays data' },
	"Camera's selecteren en in Apple Home stijl tonen": {
		en: 'Select cameras and show them in Apple Home style'
	},
	'Weekkalender met CalDAV personen en kleuren': { en: 'Week calendar with CalDAV people and colors' },
	'Lampknop met helderheid en kleur': { en: 'Light button with brightness and color' },
	'Thermostaatknop met temperatuur en modus': { en: 'Thermostat button with temperature and mode' },
	'Gordijnknop met positiebediening': { en: 'Cover button with position control' },
	'Robotstofzuiger met start, pauze en dock': { en: 'Robot vacuum with start, pause, and dock' },
	'Media player met afspelen en volume': { en: 'Media player with playback and volume' },
	'Koppel aan een alarm-entiteit': { en: 'Link an alarm entity' },
	'Alarm-entiteit': { en: 'Alarm entity' },
	'Weer-entiteit': { en: 'Weather entity' },
	gekoppeld: { en: 'linked' },
	'Selecteer het alarm_control_panel uit Home Assistant.': {
		en: 'Select the alarm_control_panel from Home Assistant.'
	},
	'Selecteer een weer-entiteit uit Home Assistant.': { en: 'Select a weather entity from Home Assistant.' },
	'Kies uit beschikbare entiteiten': { en: 'Choose from available entities' },
	'Of typ handmatig': { en: 'Or type manually' },
	'Selecteer welke lampen meedoen': { en: 'Select which lights are included' },
	'Selecteer lampen voor deze groep': { en: 'Select lights for this group' },
	Groepsnaam: { en: 'Group name' },
	'in andere groep': { en: 'in another group' },
	'Voeg eerst lampen toe via de entiteitenlijst hierboven.': {
		en: 'Add lights through the entity list above first.'
	},
	'Verwijder groep': { en: 'Delete group' },
	Opslaan: { en: 'Save', de: 'Speichern', fr: 'Enregistrer', es: 'Guardar' },
	'Stijl en weergave': { en: 'Style and display' },
	'Kies wat de klok toont: digitaal, analoog of beide.': {
		en: 'Choose what the clock shows: digital, analog, or both.'
	},
	Stijl: { en: 'Style', de: 'Stil', fr: 'Style', es: 'Estilo' },
	'Live voorbeeld': { en: 'Live preview' },
	'Kies een kaart om toe te voegen': { en: 'Choose a card to add' },
	'Kies een speler in het tabblad Spelers': { en: 'Choose a player in the Players tab' },
	Spelers: { en: 'Players', de: 'Spieler', fr: 'Lecteurs', es: 'Reproductores' },
	'Verbind Novapanel met je Spotify-account om afspeellijsten en zoekresultaten te zien.': {
		en: 'Connect Novapanel to your Spotify account to see playlists and search results.'
	},
	'Verbinden met Spotify': { en: 'Connect to Spotify' },
	'Voltooi de Spotify-koppeling in het nieuwe tabblad. Deze pagina pikt het automatisch op.': {
		en: 'Complete the Spotify connection in the new tab. This page will pick it up automatically.'
	},
	'Kies speelapparaat…': { en: 'Choose playback device…' },
	'Radio favorieten': { en: 'Radio favorites' },
	Zoeken: { en: 'Search', de: 'Suchen', fr: 'Rechercher', es: 'Buscar' },
	'Stations zoeken': { en: 'Search stations' },
	'Eigen URL': { en: 'Custom URL' },
	'Eigen stream-URL toevoegen': { en: 'Add custom stream URL' },
	Hernoemen: { en: 'Rename', de: 'Umbenennen', fr: 'Renommer', es: 'Renombrar' },
	'Naam wijzigen': { en: 'Change name' },
	'Naam aanpassen': { en: 'Edit name' },
	'Verslepen om te herordenen': { en: 'Drag to reorder' },
	'Sleep om volgorde te wijzigen': { en: 'Drag to change order' },
	'Stream-URL': { en: 'Stream URL' },
	'Nog geen zones. Voeg er hieronder een toe.': { en: 'No zones yet. Add one below.' },
	'+ Zone toevoegen…': { en: '+ Add zone…' },
	'Verwijderen uit favorieten': { en: 'Remove from favorites' },
	'Aan favorieten toevoegen': { en: 'Add to favorites' },
	'Nog geen favorieten. Klik op het zoek-icon hierboven om stations te zoeken via TuneIn, of op het link-icon om je eigen stream-URL toe te voegen.':
		{
			en: 'No favorites yet. Click the search icon above to search stations via TuneIn, or the link icon to add your own stream URL.'
		},
	'Spotify gaf "te veel verzoeken" terug. Novapanel pauzeert nu een minuut en probeert daarna automatisch opnieuw.':
		{
			en: 'Spotify returned "too many requests". Novapanel is pausing for one minute and will retry automatically.'
		},
	'Geen actief Spotify-apparaat. Kies eerst een apparaat in de "Spotify-apparaat"-lijst hierboven, of zet je Onkyo aan en schakel naar de Spotify-bron — dan verschijnt hij in de lijst.':
		{
			en: 'No active Spotify device. First choose a device in the "Spotify device" list above, or turn on your Onkyo and switch to the Spotify source so it appears in the list.'
		},
	'Voor afspelen via Spotify Connect heb je een Spotify Premium-abonnement nodig.': {
		en: 'Playback through Spotify Connect requires a Spotify Premium subscription.'
	},
	'Dit apparaat kan niet via Spotify Connect bediend worden.': {
		en: 'This device cannot be controlled through Spotify Connect.'
	},
	'Deze actie is niet beschikbaar in de huidige afspeel-context.': {
		en: 'This action is not available in the current playback context.'
	},
	'Spotify staat al op pauze.': { en: 'Spotify is already paused.' },
	'Spotify is al aan het afspelen.': { en: 'Spotify is already playing.' },
	'Spotify gaf een onbekende fout terug. Probeer opnieuw of selecteer een ander apparaat.': {
		en: 'Spotify returned an unknown error. Try again or select another device.'
	},
	'Geen geldige MA-speler geselecteerd.': { en: 'No valid MA player selected.' },
	'Geselecteerde speler niet meer beschikbaar.': { en: 'Selected player is no longer available.' },
	'Spotify-verbinding is verlopen. Open Settings en verbind opnieuw.': {
		en: 'Spotify connection expired. Open Settings and reconnect.'
	},
	'Spotify heeft deze actie geweigerd. Mogelijk geen Premium of geen rechten op dit apparaat.': {
		en: 'Spotify rejected this action. You may need Premium or permission for this device.'
	},
	'Te veel verzoeken naar Spotify. Wacht een paar tellen en probeer opnieuw.': {
		en: 'Too many requests to Spotify. Wait a moment and try again.'
	},
	'Geen actief Spotify-apparaat. Kies eerst een apparaat in de lijst hierboven.': {
		en: 'No active Spotify device. Choose a device in the list above first.'
	},
	'Er ging iets mis bij Spotify. Probeer het opnieuw.': {
		en: 'Something went wrong with Spotify. Try again.'
	},
	'Spotify-auth start mislukte': { en: 'Spotify auth start failed' },
	'Geen auth-URL ontvangen.': { en: 'No auth URL received.' },
	'Geen Spotify-controller in Home Assistant gevonden om naar de Onkyo door te schakelen.': {
		en: 'No Spotify controller found in Home Assistant to route to the Onkyo.'
	},
	'Kies eerst een speelapparaat in de dropdown hierboven.': {
		en: 'Choose a playback device in the dropdown above first.'
	},
	'Onkyo niet zichtbaar in Spotify Connect — speel eerst iets af om de bridge te activeren.': {
		en: 'Onkyo is not visible in Spotify Connect — play something first to activate the bridge.'
	},
	'Kies eerst een speler hierboven.': { en: 'Choose a player above first.' },
	'Welke entiteiten': { en: 'Which entities' },
	'Kies de domeinen die meetellen, en/of selecteer specifieke entiteiten handmatig.': {
		en: 'Choose the domains to include, and/or manually select specific entities.'
	},
	Domeinen: { en: 'Domains', de: 'Domänen', fr: 'Domaines', es: 'Dominios' },
	'komma-gescheiden': { en: 'comma-separated' },
	Icoon: { en: 'Icon', de: 'Symbol', fr: 'Icône', es: 'Icono' },
	'MDI naam, bv. lightbulb': { en: 'MDI name, e.g. lightbulb' },
	'Optioneel. Beperk tot specifieke device classes (door, window, garage…).': {
		en: 'Optional. Limit to specific device classes (door, window, garage…).'
	},
	Classes: { en: 'Classes', de: 'Klassen', fr: 'Classes', es: 'Clases' },
	'Welke deuren en ramen zijn open': { en: 'Which doors and windows are open' },
	'Welke apparaten staan aan': { en: 'Which devices are on' },
	'Welke apparaten zijn bereikbaar': { en: 'Which devices are reachable' },
	'Welke spelers worden gevolgd': { en: 'Which players are tracked' },
	'Welke lampen zijn aan': { en: 'Which lights are on' },
	Openingen: { en: 'Openings', de: 'Öffnungen', fr: 'Ouvertures', es: 'Aperturas' },
	Beschikbaarheid: { en: 'Availability', de: 'Verfügbarkeit', fr: 'Disponibilité', es: 'Disponibilidad' },
	'Bereikbaarheid en batterijen': { en: 'Reachability and batteries' },
	'Spelers en queue': { en: 'Players and queue' },
	'Stijl en weergave van de klok': { en: 'Clock style and display' },
	'Datumweergave instellen': { en: 'Configure date display' },
	'Koppel aan een weer-entiteit': { en: 'Link a weather entity' },
	'Voorspelling weergeven': { en: 'Show forecast' },
	Tonen: { en: 'Show', de: 'Anzeigen', fr: 'Afficher', es: 'Mostrar' },
	Verbergen: { en: 'Hide', de: 'Ausblenden', fr: 'Masquer', es: 'Ocultar' },
	leeg: { en: 'empty', de: 'leer', fr: 'vide', es: 'vacío' },
	ingevuld: { en: 'filled', de: 'ausgefüllt', fr: 'rempli', es: 'completado' },
	vereist: { en: 'required', de: 'erforderlich', fr: 'requis', es: 'obligatorio' },
	'geen apparaten': { en: 'no devices' },
	apparaat: { en: 'device', de: 'Gerät', fr: 'appareil', es: 'dispositivo' },
	apparaten: { en: 'devices', de: 'Geräte', fr: 'appareils', es: 'dispositivos' },
	'geen kWh': { en: 'no kWh' },
	'kWh-teller': { en: 'kWh meter' },
	'kWh-tellers': { en: 'kWh meters' },
	standaard: { en: 'default', de: 'Standard', fr: 'par défaut', es: 'predeterminado' },
	Standaard: { en: 'Default', de: 'Standard', fr: 'Par défaut', es: 'Predeterminado' },
	'volledig aangepast': { en: 'fully customized' },
	"foto's": { en: 'photos', de: 'Fotos', fr: 'photos', es: 'fotos' },
	ankers: { en: 'anchors' },
	'Live vermogen': { en: 'Live power' },
	'Real-time vermogen in W. Positief = afname uit het net, negatief = teruglevering.': {
		en: 'Real-time power in W. Positive = grid import, negative = export.'
	},
	'Netto verbruik': { en: 'Net consumption' },
	Zonnepanelen: { en: 'Solar panels' },
	Huisverbruik: { en: 'Home consumption' },
	'Accu vermogen': { en: 'Battery power' },
	'Accu lading': { en: 'Battery charge' },
	'kWh-tellers via Utility Meter helpers in Home Assistant.': {
		en: 'kWh meters via Utility Meter helpers in Home Assistant.'
	},
	'Optioneel. Bedragen in euro per kWh-stand vandaag.': {
		en: 'Optional. Amounts in euros per kWh reading today.'
	},
	'Compensatie teruglevering': { en: 'Export compensation' },
	'Auto en laadpaal': { en: 'Car and charger' },
	'Wanneer ingevuld worden de auto-flows automatisch geactiveerd in de detailweergave.': {
		en: 'When configured, car flows are automatically enabled in the detail view.'
	},
	'Laadpaal status': { en: 'Charger status' },
	'Kabel ingeplugd': { en: 'Cable plugged in' },
	Laadvermogen: { en: 'Charging power' },
	'Live vermogen per apparaat': { en: 'Live power per device' },
	'Selecteer de apparaten waarvan je het live vermogen wilt zien in de afname-sub-pop-up. Toont alleen entiteiten met W/kW als eenheid of':
		{
			en: 'Select the devices whose live power should appear in the import sub-popup. Only shows entities with W/kW as unit or'
		},
	'kWh vandaag per apparaat': { en: 'kWh today per device' },
	'Optioneel. Selecteer de bijbehorende kWh-tellers per apparaat (zelfde apparaat als hierboven). Toont alleen entiteiten met kWh/Wh als eenheid of':
		{
			en: 'Optional. Select the matching kWh meters per device (same device as above). Only shows entities with kWh/Wh as unit or'
		},
	"Eigen foto's en ankerpunten": { en: 'Custom photos and anchor points' },
	'Per scenario een eigen foto en ankerpunten voor de flow-lijnen.': {
		en: 'Custom photo and anchor points per scenario for the flow lines.'
	},
	'Eigen foto': { en: 'Custom photo' },
	'Overdag, geen auto': { en: 'Daytime, no car' },
	'Overdag, met auto': { en: 'Daytime, with car' },
	"'s Avonds, geen auto": { en: 'Evening, no car' },
	"'s Avonds, met auto": { en: 'Evening, with car' },
	'Foto wijzig': { en: 'Change photo' },
	'Foto…': { en: 'Photo…' },
	Reset: { en: 'Reset', de: 'Zurücksetzen', fr: 'Réinitialiser', es: 'Restablecer' },
	'Ankers ✓': { en: 'Anchors ✓' },
	'Ankers…': { en: 'Anchors…' },
	'Sectie hernoemen': { en: 'Rename section' },
	'Sectie zonder titel': { en: 'Untitled section' },
	Sectienaam: { en: 'Section name' },
	Ma: { en: 'Mo', de: 'Mo', fr: 'Lu', es: 'Lu' },
	Alarmpaneel: { en: 'Alarm panel' },
	aan: { en: 'on', de: 'ein', fr: 'allumé', es: 'encendido' },
	Leeslamp: { en: 'Reading light' },
	Thermostaat: { en: 'Thermostat' },
	Gordijnen: { en: 'Curtains' },
	open: { en: 'open', de: 'offen', fr: 'ouvert', es: 'abierto' },
	Woonkamer: { en: 'Living room' },
	'Speelt muziek': { en: 'Playing music' },
	'Ramen/Deuren': { en: 'Windows/Doors' },
	Apparatenstatus: { en: 'Device status' },
	'Alles bereikbaar': { en: 'Everything reachable' },
	Thuisaccu: { en: 'Home battery' },
	'Buig flow-lijnen': { en: 'Bend flow lines' },
	Accu: { en: 'Battery' },
	Voordeur: { en: 'Front door' },
	'Auto-laadpunt': { en: 'Car charger' },
	'Straat / net': { en: 'Street / grid' },
	'Rail (fallback)': { en: 'Rail (fallback)' },
	'Klik op de foto om een buigpunt toe te voegen, of sleep een bestaand punt. Klik op een buigpunt om te verwijderen.':
		{
			en: 'Click the photo to add a bend point, or drag an existing point. Click a bend point to remove it.'
		},
	'Buigpunt toevoegen': { en: 'Add bend point' },
	'Wis alle buigpunten': { en: 'Clear all bend points' },
	'Klik op de foto om het geselecteerde anker te plaatsen, of sleep een anker direct.': {
		en: 'Click the photo to place the selected anchor, or drag an anchor directly.'
	},
	'Reset alle ankers': { en: 'Reset all anchors' },
	'Sleep om te verplaatsen, klik om te verwijderen': { en: 'Drag to move, click to remove' },
	'Zon → Accu': { en: 'Solar → Battery' },
	'Zon → Auto': { en: 'Solar → Car' },
	'Zon → Huis': { en: 'Solar → Home' },
	'Zon → Net': { en: 'Solar → Grid' },
	'Net → Huis': { en: 'Grid → Home' },
	'Net → Auto': { en: 'Grid → Car' },
	'Net → Accu': { en: 'Grid → Battery' },
	'Accu → Huis': { en: 'Battery → Home' },
	'Accu → Auto': { en: 'Battery → Car' },
	'Kaart bewerken': { en: 'Edit card' }
};

const phraseTranslationCompletions: Record<string, Partial<Record<LanguageCode, string>>> = {
	Aanvullend: { en: 'Additional', de: 'Zusätzlich', fr: 'Supplémentaire', es: 'Adicional' },
	Aangemaakt: { nl: 'Aangemaakt', en: 'Created', de: 'Erstellt', fr: 'Créé', es: 'Creado' },
	'Aangemaakt door': {
		nl: 'Aangemaakt door',
		en: 'Created by',
		de: 'Erstellt von',
		fr: 'Créé par',
		es: 'Creado por'
	},
	'Afname dal': {
		en: 'Off-peak import',
		de: 'Bezug Niedertarif',
		fr: 'Prélèvement heures creuses',
		es: 'Importación valle'
	},
	'Afname piek': {
		en: 'Peak import',
		de: 'Bezug Hochtarif',
		fr: 'Prélèvement heures pleines',
		es: 'Importación punta'
	},
	Bereikbaarheid: { en: 'Availability', de: 'Verfügbarkeit', fr: 'Disponibilité', es: 'Disponibilidad' },
	Bijgewerkt: { nl: 'Bijgewerkt', en: 'Updated', de: 'Aktualisiert', fr: 'Mis à jour', es: 'Actualizado' },
	'Bewerksessie gestart': {
		en: 'Edit session started',
		de: 'Bearbeitungssitzung gestartet',
		fr: 'Session de modification démarrée',
		es: 'Sesión de edición iniciada'
	},
	'Dashboard is gewijzigd op een ander apparaat.': {
		en: 'The dashboard was changed on another device.',
		de: 'Das Dashboard wurde auf einem anderen Gerät geändert.',
		fr: 'Le tableau de bord a été modifié sur un autre appareil.',
		es: 'El panel se ha modificado en otro dispositivo.'
	},
	'Laatst bijgewerkt': {
		en: 'Last updated',
		de: 'Zuletzt aktualisiert',
		fr: 'Dernière mise à jour',
		es: 'Última actualización'
	},
	'Laatste serverwijziging': {
		en: 'Last server change',
		de: 'Letzte Serveränderung',
		fr: 'Dernière modification serveur',
		es: 'Último cambio del servidor'
	},
	'Als je nu opslaat, overschrijf je die wijzigingen. Doorgaan?': {
		en: 'If you save now, you will overwrite those changes. Continue?',
		de: 'Wenn du jetzt speicherst, überschreibst du diese Änderungen. Fortfahren?',
		fr: 'Si vous enregistrez maintenant, vous écraserez ces modifications. Continuer ?',
		es: 'Si guardas ahora, sobrescribirás esos cambios. ¿Continuar?'
	},
	'Dal tarief': { en: 'Off-peak tariff', de: 'Niedertarif', fr: 'Tarif heures creuses', es: 'Tarifa valle' },
	Deelnemers: { nl: 'Deelnemers', en: 'Attendees', de: 'Teilnehmer', fr: 'Participants', es: 'Asistentes' },
	Groep: { en: 'Group', de: 'Gruppe', fr: 'Groupe', es: 'Grupo' },
	Herhaling: { nl: 'Herhaling', en: 'Recurrence', de: 'Wiederholung', fr: 'Récurrence', es: 'Repetición' },
	'Import tarief sensor': {
		en: 'Import tariff sensor',
		de: 'Importtarif-Sensor',
		fr: 'Capteur de tarif d’import',
		es: 'Sensor de tarifa de importación'
	},
	Kaart: { nl: 'Kaart', en: 'Map', de: 'Karte', fr: 'Carte', es: 'Mapa' },
	Kalender: { nl: 'Kalender', en: 'Calendar', de: 'Kalender', fr: 'Calendrier', es: 'Calendario' },
	'Kies een lamp of groep': {
		en: 'Choose a light or group',
		de: 'Licht oder Gruppe wählen',
		fr: 'Choisir une lumière ou un groupe',
		es: 'Elegir una luz o grupo'
	},
	Laag: { en: 'Low', de: 'Niedrig', fr: 'Faible', es: 'Bajo' },
	Link: { nl: 'Link', en: 'Link', de: 'Link', fr: 'Lien', es: 'Enlace' },
	Locatie: { nl: 'Locatie', en: 'Location', de: 'Standort', fr: 'Lieu', es: 'Ubicación' },
	Matig: { en: 'Moderate', de: 'Mäßig', fr: 'Modéré', es: 'Moderado' },
	'Namen per apparaat': {
		en: 'Names per device',
		de: 'Namen pro Gerät',
		fr: 'Noms par appareil',
		es: 'Nombres por dispositivo'
	},
	'Nog niet bijgewerkt': {
		en: 'Not updated yet',
		de: 'Noch nicht aktualisiert',
		fr: 'Pas encore mis à jour',
		es: 'Aún no actualizado'
	},
	Notities: { en: 'Notes', de: 'Notizen', fr: 'Notes', es: 'Notas' },
	Ontgrendelen: { en: 'Unlock', de: 'Entsperren', fr: 'Déverrouiller', es: 'Desbloquear' },
	Oppervlak: { en: 'Area', de: 'Fläche', fr: 'Surface', es: 'Superficie' },
	Extreem: { en: 'Extreme', de: 'Extrem', fr: 'Extrême', es: 'Extremo' },
	Hoog: { en: 'High', de: 'Hoch', fr: 'Élevé', es: 'Alto' },
	Organisator: {
		nl: 'Organisator',
		en: 'Organizer',
		de: 'Organisator',
		fr: 'Organisateur',
		es: 'Organizador'
	},
	'Optioneel. Gebruik eerst exacte kostensensoren uit Home Assistant. Zonder die sensoren rekent Nova Panel met piek/dal of met actuele tariefsensoren.':
		{
			en: 'Optional. Use exact cost sensors from Home Assistant first. Without those sensors, Nova Panel calculates with peak/off-peak or live tariff sensors.',
			de: 'Optional. Verwende zuerst exakte Kostensensoren aus Home Assistant. Ohne diese Sensoren rechnet Nova Panel mit Hoch-/Niedertarif oder aktuellen Tarifsensoren.',
			fr: 'Facultatif. Utilisez d’abord les capteurs de coûts exacts de Home Assistant. Sans eux, Nova Panel calcule avec les tarifs heures pleines/creuses ou des capteurs de tarif actuels.',
			es: 'Opcional. Usa primero sensores de coste exactos de Home Assistant. Sin esos sensores, Nova Panel calcula con tarifas punta/valle o sensores de tarifa actuales.'
		},
	'Pas hier de namen aan die Nova Panel toont. De oorspronkelijke Home Assistant naam blijft tussen haakjes zichtbaar.':
		{
			en: 'Adjust the names Nova Panel shows here. The original Home Assistant name remains visible in parentheses.',
			de: 'Passe hier die Namen an, die Nova Panel anzeigt. Der ursprüngliche Home-Assistant-Name bleibt in Klammern sichtbar.',
			fr: 'Modifiez ici les noms affichés par Nova Panel. Le nom Home Assistant d’origine reste visible entre parenthèses.',
			es: 'Ajusta aquí los nombres que muestra Nova Panel. El nombre original de Home Assistant seguirá visible entre paréntesis.'
		},
	'Piek tarief': { en: 'Peak tariff', de: 'Hochtarif', fr: 'Tarif heures pleines', es: 'Tarifa punta' },
	'Piek/dal berekening': {
		en: 'Peak/off-peak calculation',
		de: 'Hoch-/Niedertarif-Berechnung',
		fr: 'Calcul heures pleines/creuses',
		es: 'Cálculo punta/valle'
	},
	'Teruglever tarief': {
		en: 'Export tariff',
		de: 'Einspeisetarif',
		fr: 'Tarif de revente',
		es: 'Tarifa de exportación'
	},
	'Teruglever tarief sensor': {
		en: 'Export tariff sensor',
		de: 'Einspeisetarif-Sensor',
		fr: 'Capteur de tarif de revente',
		es: 'Sensor de tarifa de exportación'
	},
	Tijd: { en: 'Time', de: 'Zeit', fr: 'Heure', es: 'Hora' },
	'Variabel contract': {
		en: 'Variable contract',
		de: 'Variabler Vertrag',
		fr: 'Contrat variable',
		es: 'Contrato variable'
	},
	'Voelt als': { en: 'Feels like', de: 'Gefühlt wie', fr: 'Ressenti', es: 'Sensación de' },
	'Verbinding starten…': {
		en: 'Starting connection…',
		de: 'Verbindung wird gestartet…',
		fr: 'Démarrage de la connexion…',
		es: 'Iniciando conexión…'
	},
	'Verbinding met Home Assistant kwijt': {
		en: 'Home Assistant connection lost',
		de: 'Verbindung zu Home Assistant verloren',
		fr: 'Connexion à Home Assistant perdue',
		es: 'Conexión con Home Assistant perdida'
	},
	Vergrendelen: { en: 'Lock', de: 'Sperren', fr: 'Verrouiller', es: 'Bloquear' },
	Wanneer: { nl: 'Wanneer', en: 'When', de: 'Wann', fr: 'Quand', es: 'Cuándo' },
	'Zeer hoog': { en: 'Very high', de: 'Sehr hoch', fr: 'Très élevé', es: 'Muy alto' },
	kostensensor: {
		nl: 'kostensensor',
		en: 'cost sensor',
		de: 'Kostensensor',
		fr: 'capteur de coût',
		es: 'sensor de coste'
	},
	lampen: { en: 'lights', de: 'Lichter', fr: 'lumières', es: 'luces' },
	'piek/dal ingesteld': {
		nl: 'piek/dal ingesteld',
		en: 'peak/off-peak set',
		de: 'Hoch-/Niedertarif eingestellt',
		fr: 'heures pleines/creuses configurées',
		es: 'punta/valle configurado'
	},
	'komende 24u': { en: 'next 24h', de: 'nächste 24 Std.', fr: 'prochaines 24 h', es: 'próximas 24 h' },
	tariefsensor: {
		nl: 'tariefsensor',
		en: 'tariff sensor',
		de: 'Tarifsensor',
		fr: 'capteur de tarif',
		es: 'sensor de tarifa'
	},
	tot: { en: 'to', de: 'bis', fr: 'à', es: 'hasta' },
	Energieoverzicht: { de: 'Energieübersicht', fr: 'Vue énergétique', es: 'Resumen de energía' },
	'Bekijk verbruik per apparaat': {
		de: 'Verbrauch pro Gerät anzeigen',
		fr: 'Voir la consommation par appareil',
		es: 'Ver consumo por dispositivo'
	},
	'Verbruik per apparaat': {
		de: 'Verbrauch pro Gerät',
		fr: 'Consommation par appareil',
		es: 'Consumo por dispositivo'
	},
	'Live verbruik': { de: 'Live-Verbrauch', fr: 'Consommation en direct', es: 'Consumo en directo' },
	'apparaten actief': { de: 'Geräte aktiv', fr: 'appareils actifs', es: 'dispositivos activos' },
	'sinds 00:00': { de: 'seit 00:00', fr: 'depuis 00:00', es: 'desde las 00:00' },
	'Huidig verbruik': { de: 'Aktueller Verbrauch', fr: 'Consommation actuelle', es: 'Consumo actual' },
	'Geen apparaten geconfigureerd.': {
		de: 'Keine Geräte konfiguriert.',
		fr: 'Aucun appareil configuré.',
		es: 'No hay dispositivos configurados.'
	},
	'Alle apparaten verborgen — klik er hieronder eentje aan.': {
		de: 'Alle Geräte sind ausgeblendet — klicke unten eines an.',
		fr: 'Tous les appareils sont masqués — cliquez sur l’un d’eux ci-dessous.',
		es: 'Todos los dispositivos están ocultos — pulsa uno abajo.'
	},
	Verwarmen: { de: 'Heizen', fr: 'Chauffage', es: 'Calefacción' },
	'Geen entiteiten gevonden voor je zoekopdracht.': {
		de: 'Keine Entitäten für deine Suche gefunden.',
		fr: 'Aucune entité trouvée pour votre recherche.',
		es: 'No se encontraron entidades para tu búsqueda.'
	},
	'Geen entiteiten beschikbaar.': {
		de: 'Keine Entitäten verfügbar.',
		fr: 'Aucune entité disponible.',
		es: 'No hay entidades disponibles.'
	},
	'Kamerinformatie laden…': {
		de: 'Rauminformationen werden geladen…',
		fr: 'Chargement des informations de pièce…',
		es: 'Cargando información de la habitación…'
	},
	'Lamp entiteit': { de: 'Licht-Entität', fr: 'Entité lumière', es: 'Entidad de luz' },
	'Gebruik een Material Design Icon naam, bijvoorbeeld': {
		de: 'Verwende einen Material-Design-Icon-Namen, zum Beispiel',
		fr: 'Utilisez un nom d’icône Material Design, par exemple',
		es: 'Usa un nombre de icono Material Design, por ejemplo'
	},
	'Sla de kaart daarna op.': {
		de: 'Speichere die Karte danach.',
		fr: 'Enregistrez ensuite la carte.',
		es: 'Después guarda la tarjeta.'
	},
	'Kies CalDAV kalender-entiteiten, koppel optioneel een person-entiteit, geef iedere persoon een kleur en zet ze in de juiste volgorde.':
		{
			de: 'Wähle CalDAV-Kalenderentitäten, verknüpfe optional eine Personen-Entität, gib jeder Person eine Farbe und sortiere sie.',
			fr: 'Choisissez des entités calendrier CalDAV, liez éventuellement une entité person, donnez une couleur à chaque personne et définissez l’ordre.',
			es: 'Elige entidades de calendario CalDAV, vincula opcionalmente una entidad person, asigna un color a cada persona y ordénalas.'
		},
	'Nog geen kalenders geselecteerd. Je kunt ook handmatig een entity id invullen, bijvoorbeeld': {
		de: 'Noch keine Kalender ausgewählt. Du kannst auch manuell eine Entity-ID eingeben, zum Beispiel',
		fr: 'Aucun calendrier sélectionné. Vous pouvez aussi saisir manuellement un ID d’entité, par exemple',
		es: 'Aún no hay calendarios seleccionados. También puedes introducir manualmente un ID de entidad, por ejemplo'
	},
	'Deze redirect gebruikt nog de oude /local_novapanel-route. Novapanel vervangt dit bij verbinden automatisch door de callback-URL hieronder, maar plak die nieuwe URL ook in het Spotify Dashboard.':
		{
			de: 'Diese Weiterleitung nutzt noch die alte /local_novapanel-Route. Novapanel ersetzt sie beim Verbinden automatisch durch die Callback-URL unten; füge diese neue URL auch im Spotify-Dashboard ein.',
			fr: 'Cette redirection utilise encore l’ancienne route /local_novapanel. Novapanel la remplace automatiquement par l’URL de rappel ci-dessous lors de la connexion, mais collez aussi cette nouvelle URL dans le tableau de bord Spotify.',
			es: 'Esta redirección aún usa la antigua ruta /local_novapanel. Novapanel la sustituye automáticamente por la URL de callback de abajo al conectar, pero pega también esa nueva URL en el panel de Spotify.'
		},
	'Klik op Create app, vul een naam en omschrijving in, voeg de callback-URL hieronder toe bij Redirect URI, vink Web API aan en accepteer de voorwaarden. Kopieer daarna de Client ID uit het app-overzicht hierheen.':
		{
			de: 'Klicke auf Create app, gib Name und Beschreibung ein, füge die Callback-URL unten bei Redirect URI hinzu, aktiviere Web API und akzeptiere die Bedingungen. Kopiere danach die Client ID aus der App-Übersicht hierher.',
			fr: 'Cliquez sur Create app, saisissez un nom et une description, ajoutez l’URL de rappel ci-dessous dans Redirect URI, cochez Web API et acceptez les conditions. Copiez ensuite le Client ID depuis l’aperçu de l’app ici.',
			es: 'Haz clic en Create app, introduce nombre y descripción, añade la URL de callback de abajo en Redirect URI, marca Web API y acepta las condiciones. Luego copia aquí el Client ID desde el resumen de la app.'
		},
	'Open je app in het dashboard, klik op Settings en daarna op View client secret. Kopieer de Client Secret hierheen.':
		{
			de: 'Öffne deine App im Dashboard, klicke auf Settings und dann auf View client secret. Kopiere das Client Secret hierher.',
			fr: 'Ouvrez votre app dans le tableau de bord, cliquez sur Settings puis sur View client secret. Copiez le Client Secret ici.',
			es: 'Abre tu app en el panel, haz clic en Settings y después en View client secret. Copia aquí el Client Secret.'
		},
	'open Settings en plak exact deze callback-URL bij Redirect URIs:': {
		de: 'öffne Settings und füge exakt diese Callback-URL bei Redirect URIs ein:',
		fr: 'ouvrez Settings et collez exactement cette URL de rappel dans Redirect URIs :',
		es: 'abre Settings y pega exactamente esta URL de callback en Redirect URIs:'
	},
	'Spotify vereist een exacte match en meestal HTTPS. Gebruik precies de URL hierboven; bij Home Assistant ingress hoort daar meestal':
		{
			de: 'Spotify verlangt eine exakte Übereinstimmung und meist HTTPS. Verwende genau die URL oben; bei Home-Assistant-Ingress gehört dort normalerweise',
			fr: 'Spotify exige une correspondance exacte et généralement HTTPS. Utilisez exactement l’URL ci-dessus ; avec l’ingress Home Assistant, elle doit généralement contenir',
			es: 'Spotify requiere una coincidencia exacta y normalmente HTTPS. Usa exactamente la URL de arriba; con ingress de Home Assistant normalmente debe incluir'
		},
	'in te staan. Als Home Assistant later een andere ingress-token toont, kopieer dan de nieuwe callback-URL opnieuw naar Spotify.':
		{
			de: 'hinein. Wenn Home Assistant später ein anderes Ingress-Token zeigt, kopiere die neue Callback-URL erneut zu Spotify.',
			fr: '. Si Home Assistant affiche plus tard un autre jeton ingress, recopiez la nouvelle URL de rappel dans Spotify.',
			es: '. Si Home Assistant muestra más tarde otro token ingress, copia de nuevo la URL de callback a Spotify.'
		},
	'Klik daarna op Add en Save. Laat dit veld leeg om de automatisch herkende callback-URL te gebruiken.': {
		de: 'Klicke danach auf Add und Save. Lasse dieses Feld leer, um die automatisch erkannte Callback-URL zu verwenden.',
		fr: 'Cliquez ensuite sur Add puis Save. Laissez ce champ vide pour utiliser l’URL de rappel détectée automatiquement.',
		es: 'Después haz clic en Add y Save. Deja este campo vacío para usar la URL de callback detectada automáticamente.'
	},
	'Voltooi de Spotify-koppeling in het nieuw geopende tabblad. Dit venster pikt het automatisch op.': {
		de: 'Schließe die Spotify-Verknüpfung im neu geöffneten Tab ab. Dieses Fenster übernimmt sie automatisch.',
		fr: 'Terminez la connexion Spotify dans le nouvel onglet. Cette fenêtre la détectera automatiquement.',
		es: 'Completa la vinculación de Spotify en la nueva pestaña. Esta ventana la detectará automáticamente.'
	},
	'Voeg camera-entiteiten toe en bepaal welke groot worden weergegeven (Apple Home stijl). Zet Advanced Camera Card aan voor de HA custom-card; extra YAML is optioneel.':
		{
			de: 'Füge Kamera-Entitäten hinzu und lege fest, welche groß angezeigt werden (Apple-Home-Stil). Aktiviere Advanced Camera Card für die HA-Custom-Card; zusätzliches YAML ist optional.',
			fr: 'Ajoutez des entités caméra et choisissez lesquelles s’affichent en grand (style Apple Home). Activez Advanced Camera Card pour la custom-card HA ; le YAML supplémentaire est facultatif.',
			es: 'Añade entidades de cámara y decide cuáles se muestran grandes (estilo Apple Home). Activa Advanced Camera Card para la custom-card de HA; el YAML extra es opcional.'
		},
	"Nog geen camera's geselecteerd.": {
		de: 'Noch keine Kameras ausgewählt.',
		fr: 'Aucune caméra sélectionnée.',
		es: 'Aún no hay cámaras seleccionadas.'
	},
	'Alle camera-entiteiten zijn al toegevoegd.': {
		de: 'Alle Kamera-Entitäten wurden bereits hinzugefügt.',
		fr: 'Toutes les entités caméra ont déjà été ajoutées.',
		es: 'Todas las entidades de cámara ya están añadidas.'
	},
	'Geen camera-entiteiten gevonden.': {
		de: 'Keine Kamera-Entitäten gefunden.',
		fr: 'Aucune entité caméra trouvée.',
		es: 'No se encontraron entidades de cámara.'
	},
	"Geen camera's geconfigureerd": {
		de: 'Keine Kameras konfiguriert',
		fr: 'Aucune caméra configurée',
		es: 'No hay cámaras configuradas'
	},
	'Geen beeld beschikbaar': {
		de: 'Kein Bild verfügbar',
		fr: 'Aucune image disponible',
		es: 'No hay imagen disponible'
	},
	'Welk type voorspelling en hoeveel dagen er getoond worden.': {
		de: 'Welche Vorhersageart und wie viele Tage angezeigt werden.',
		fr: 'Le type de prévision et le nombre de jours affichés.',
		es: 'Qué tipo de previsión y cuántos días se muestran.'
	},
	'Voorspelling voor de komende dagen': {
		de: 'Vorhersage für die kommenden Tage',
		fr: 'Prévisions pour les prochains jours',
		es: 'Previsión para los próximos días'
	},
	'Voorspelling laden…': {
		de: 'Vorhersage wird geladen…',
		fr: 'Chargement des prévisions…',
		es: 'Cargando previsión…'
	},
	'Uurvoorspelling laden…': {
		de: 'Stundenvorhersage wird geladen…',
		fr: 'Chargement de la prévision horaire…',
		es: 'Cargando previsión horaria…'
	},
	'Vandaag-totalen': { de: 'Heutige Summen', fr: 'Totaux du jour', es: 'Totales de hoy' },
	'optioneel; anders berekend': {
		de: 'optional; sonst berechnet',
		fr: 'facultatif ; sinon calculé',
		es: 'opcional; si no, calculado'
	},
	'Groepen tellen als 1 item in het overzicht. Handig om "Woonkamer" als één entiteit te zien.': {
		de: 'Gruppen zählen in der Übersicht als 1 Eintrag. Praktisch, um "Wohnzimmer" als eine Entität zu sehen.',
		fr: 'Les groupes comptent comme 1 élément dans l’aperçu. Pratique pour voir "Salon" comme une seule entité.',
		es: 'Los grupos cuentan como 1 elemento en el resumen. Útil para ver "Salón" como una sola entidad.'
	},
	'Nog geen lampen toegevoegd': {
		de: 'Noch keine Lichter hinzugefügt',
		fr: 'Aucune lumière ajoutée',
		es: 'Aún no hay luces añadidas'
	},
	'Nieuwe groepsnaam': { de: 'Neuer Gruppenname', fr: 'Nouveau nom de groupe', es: 'Nuevo nombre de grupo' },
	'Selecteer lampen voor deze groep': {
		de: 'Lichter für diese Gruppe auswählen',
		fr: 'Sélectionner les lumières de ce groupe',
		es: 'Seleccionar luces para este grupo'
	},
	Groepsnaam: { de: 'Gruppenname', fr: 'Nom du groupe', es: 'Nombre del grupo' },
	'in andere groep': { de: 'in anderer Gruppe', fr: 'dans un autre groupe', es: 'en otro grupo' },
	'Voeg eerst lampen toe via de entiteitenlijst hierboven.': {
		de: 'Füge zuerst Lichter über die Entitätenliste oben hinzu.',
		fr: 'Ajoutez d’abord des lumières via la liste d’entités ci-dessus.',
		es: 'Añade primero luces desde la lista de entidades de arriba.'
	},
	'Verwijder groep': { de: 'Gruppe löschen', fr: 'Supprimer le groupe', es: 'Eliminar grupo' },
	'Kies een kaart om toe te voegen': {
		de: 'Karte zum Hinzufügen wählen',
		fr: 'Choisir une carte à ajouter',
		es: 'Elegir una tarjeta para añadir'
	},
	'Naam aanpassen': { de: 'Namen bearbeiten', fr: 'Modifier le nom', es: 'Editar nombre' },
	'geen kWh': { de: 'keine kWh', fr: 'aucun kWh', es: 'sin kWh' },
	ankers: { de: 'Anker', fr: 'ancres', es: 'anclajes' },
	'Live vermogen': { de: 'Live-Leistung', fr: 'Puissance en direct', es: 'Potencia en directo' },
	'Real-time vermogen in W. Positief = afname uit het net, negatief = teruglevering.': {
		de: 'Echtzeitleistung in W. Positiv = Bezug aus dem Netz, negativ = Einspeisung.',
		fr: 'Puissance en temps réel en W. Positif = prélèvement réseau, négatif = injection.',
		es: 'Potencia en tiempo real en W. Positivo = importación de la red, negativo = exportación.'
	},
	'Netto verbruik': { de: 'Nettoverbrauch', fr: 'Consommation nette', es: 'Consumo neto' },
	Zonnepanelen: { de: 'Solarmodule', fr: 'Panneaux solaires', es: 'Paneles solares' },
	Huisverbruik: { de: 'Hausverbrauch', fr: 'Consommation de la maison', es: 'Consumo de la casa' },
	'Accu vermogen': { de: 'Batterieleistung', fr: 'Puissance de la batterie', es: 'Potencia de batería' },
	'Accu lading': { de: 'Batterieladung', fr: 'Charge de la batterie', es: 'Carga de batería' },
	'kWh-tellers via Utility Meter helpers in Home Assistant.': {
		de: 'kWh-Zähler über Utility-Meter-Helfer in Home Assistant.',
		fr: 'Compteurs kWh via les helpers Utility Meter dans Home Assistant.',
		es: 'Contadores kWh mediante helpers Utility Meter en Home Assistant.'
	},
	'Compensatie teruglevering': {
		de: 'Einspeisevergütung',
		fr: 'Compensation de revente',
		es: 'Compensación por exportación'
	},
	'Auto en laadpaal': {
		de: 'Auto und Ladestation',
		fr: 'Voiture et borne de recharge',
		es: 'Coche y cargador'
	},
	'Wanneer ingevuld worden de auto-flows automatisch geactiveerd in de detailweergave.': {
		de: 'Wenn ausgefüllt, werden die Auto-Flows in der Detailansicht automatisch aktiviert.',
		fr: 'Une fois renseigné, les flux de voiture sont activés automatiquement dans la vue détaillée.',
		es: 'Al configurarlo, los flujos del coche se activan automáticamente en la vista de detalle.'
	},
	'Laadpaal status': { de: 'Ladestationsstatus', fr: 'État de la borne', es: 'Estado del cargador' },
	'Kabel ingeplugd': { de: 'Kabel eingesteckt', fr: 'Câble branché', es: 'Cable conectado' },
	Laadvermogen: { de: 'Ladeleistung', fr: 'Puissance de charge', es: 'Potencia de carga' },
	'Live vermogen per apparaat': {
		de: 'Live-Leistung pro Gerät',
		fr: 'Puissance en direct par appareil',
		es: 'Potencia en directo por dispositivo'
	},
	'Selecteer de apparaten waarvan je het live vermogen wilt zien in de afname-sub-pop-up. Toont alleen entiteiten met W/kW als eenheid of':
		{
			de: 'Wähle die Geräte, deren Live-Leistung im Bezug-Unterpopup angezeigt werden soll. Zeigt nur Entitäten mit W/kW als Einheit oder',
			fr: 'Sélectionnez les appareils dont la puissance en direct doit apparaître dans la sous-fenêtre de prélèvement. Affiche uniquement les entités avec W/kW comme unité ou',
			es: 'Selecciona los dispositivos cuya potencia en directo quieres ver en la subventana de importación. Muestra solo entidades con W/kW como unidad o'
		},
	'kWh vandaag per apparaat': {
		de: 'kWh heute pro Gerät',
		fr: 'kWh aujourd’hui par appareil',
		es: 'kWh hoy por dispositivo'
	},
	'Optioneel. Selecteer de bijbehorende kWh-tellers per apparaat (zelfde apparaat als hierboven). Toont alleen entiteiten met kWh/Wh als eenheid of':
		{
			de: 'Optional. Wähle die passenden kWh-Zähler pro Gerät (dasselbe Gerät wie oben). Zeigt nur Entitäten mit kWh/Wh als Einheit oder',
			fr: 'Facultatif. Sélectionnez les compteurs kWh correspondants par appareil (même appareil que ci-dessus). Affiche uniquement les entités avec kWh/Wh comme unité ou',
			es: 'Opcional. Selecciona los contadores kWh correspondientes por dispositivo (el mismo dispositivo que arriba). Muestra solo entidades con kWh/Wh como unidad o'
		},
	"Eigen foto's en ankerpunten": {
		de: 'Eigene Fotos und Ankerpunkte',
		fr: 'Photos personnalisées et points d’ancrage',
		es: 'Fotos propias y puntos de anclaje'
	},
	'Per scenario een eigen foto en ankerpunten voor de flow-lijnen.': {
		de: 'Pro Szenario ein eigenes Foto und Ankerpunkte für die Flusslinien.',
		fr: 'Une photo et des points d’ancrage par scénario pour les lignes de flux.',
		es: 'Una foto propia y puntos de anclaje por escenario para las líneas de flujo.'
	},
	'Sectie hernoemen': {
		de: 'Abschnitt umbenennen',
		fr: 'Renommer la section',
		es: 'Cambiar nombre de sección'
	},
	'Sectie zonder titel': { de: 'Abschnitt ohne Titel', fr: 'Section sans titre', es: 'Sección sin título' },
	Sectienaam: { de: 'Abschnittsname', fr: 'Nom de la section', es: 'Nombre de sección' },
	Alarmpaneel: { de: 'Alarmzentrale', fr: 'Panneau d’alarme', es: 'Panel de alarma' },
	Thermostaat: { de: 'Thermostat', fr: 'Thermostat', es: 'Termostato' },
	Gordijnen: { de: 'Vorhänge', fr: 'Rideaux', es: 'Cortinas' },
	'Speelt muziek': { de: 'Spielt Musik', fr: 'Lecture de musique', es: 'Reproduciendo música' },
	'Ramen/Deuren': { de: 'Fenster/Türen', fr: 'Fenêtres/portes', es: 'Ventanas/puertas' },
	Apparatenstatus: { de: 'Gerätestatus', fr: 'État des appareils', es: 'Estado de dispositivos' },
	'Alles bereikbaar': { de: 'Alles erreichbar', fr: 'Tout est disponible', es: 'Todo disponible' },
	Thuisaccu: { de: 'Hausbatterie', fr: 'Batterie domestique', es: 'Batería doméstica' },
	'Buig flow-lijnen': {
		de: 'Flusslinien biegen',
		fr: 'Courber les lignes de flux',
		es: 'Curvar líneas de flujo'
	},
	Accu: { de: 'Batterie', fr: 'Batterie', es: 'Batería' },
	'Klik op de foto om een buigpunt toe te voegen, of sleep een bestaand punt. Klik op een buigpunt om te verwijderen.':
		{
			de: 'Klicke auf das Foto, um einen Biegepunkt hinzuzufügen, oder ziehe einen vorhandenen Punkt. Klicke auf einen Biegepunkt, um ihn zu löschen.',
			fr: 'Cliquez sur la photo pour ajouter un point de courbure, ou faites glisser un point existant. Cliquez sur un point pour le supprimer.',
			es: 'Haz clic en la foto para añadir un punto de curva, o arrastra un punto existente. Haz clic en un punto para eliminarlo.'
		},
	'Buigpunt toevoegen': {
		de: 'Biegepunkt hinzufügen',
		fr: 'Ajouter un point de courbure',
		es: 'Añadir punto de curva'
	},
	'Wis alle buigpunten': {
		de: 'Alle Biegepunkte löschen',
		fr: 'Effacer tous les points de courbure',
		es: 'Borrar todos los puntos de curva'
	},
	'Klik op de foto om het geselecteerde anker te plaatsen, of sleep een anker direct.': {
		de: 'Klicke auf das Foto, um den ausgewählten Anker zu platzieren, oder ziehe einen Anker direkt.',
		fr: 'Cliquez sur la photo pour placer l’ancre sélectionnée, ou faites glisser une ancre directement.',
		es: 'Haz clic en la foto para colocar el anclaje seleccionado, o arrastra un anclaje directamente.'
	},
	'Reset alle ankers': {
		de: 'Alle Anker zurücksetzen',
		fr: 'Réinitialiser toutes les ancres',
		es: 'Restablecer todos los anclajes'
	},
	'Sleep om te verplaatsen, klik om te verwijderen': {
		de: 'Ziehen zum Verschieben, klicken zum Löschen',
		fr: 'Faites glisser pour déplacer, cliquez pour supprimer',
		es: 'Arrastra para mover, haz clic para eliminar'
	},
	'Sensor geeft geen getal': {
		de: 'Sensor liefert keine Zahl',
		fr: 'Le capteur ne fournit pas de nombre',
		es: 'El sensor no proporciona un número'
	},
	'lamp aan': { de: 'Licht an', fr: 'lumière allumée', es: 'luz encendida' },
	'lampen aan': { de: 'Lichter an', fr: 'lumières allumées', es: 'luces encendidas' },
	'Alle lampen uit': {
		de: 'Alle Lichter aus',
		fr: 'Toutes les lumières sont éteintes',
		es: 'Todas las luces apagadas'
	},
	'van totaal': { de: 'von insgesamt', fr: 'du total', es: 'del total' },
	'Alles dicht': { de: 'Alles geschlossen', fr: 'Tout est fermé', es: 'Todo cerrado' },
	'apparaat actief': { de: 'Gerät aktiv', fr: 'appareil actif', es: 'dispositivo activo' },
	'Alle apparaten uit': {
		de: 'Alle Geräte aus',
		fr: 'Tous les appareils sont éteints',
		es: 'Todos los dispositivos apagados'
	},
	'Niet bereikbaar': { de: 'Nicht erreichbar', fr: 'Injoignable', es: 'No disponible' },
	Afspelen: { de: 'Wiedergabe', fr: 'Lecture', es: 'Reproducción' },
	Inactief: { de: 'Inaktiv', fr: 'Inactif', es: 'Inactivo' },
	Koelen: { de: 'Kühlen', fr: 'Refroidissement', es: 'Enfriando' },
	Gesloten: { de: 'Geschlossen', fr: 'Fermé', es: 'Cerrado' },
	'Apparaatknop met aan/uit bediening': {
		de: 'Gerätetaste mit Ein/Aus-Steuerung',
		fr: 'Bouton d’appareil avec commande marche/arrêt',
		es: 'Botón de dispositivo con control de encendido/apagado'
	},
	'Geen kamer toegewezen': {
		de: 'Kein Raum zugewiesen',
		fr: 'Aucune pièce attribuée',
		es: 'Sin habitación asignada'
	},
	'Climate entiteit': { de: 'Klima-Entität', fr: 'Entité climat', es: 'Entidad de clima' },
	'Cover entiteit': { de: 'Cover-Entität', fr: 'Entité volet', es: 'Entidad de persiana' },
	'Vacuum entiteit': { de: 'Staubsauger-Entität', fr: 'Entité aspirateur', es: 'Entidad de aspiradora' },
	'Media player entiteit': {
		de: 'Mediaplayer-Entität',
		fr: 'Entité lecteur multimédia',
		es: 'Entidad de reproductor multimedia'
	},
	"geen camera's": { de: 'keine Kameras', fr: 'aucune caméra', es: 'sin cámaras' },
	'Advanced Camera Card kon niet worden geladen. Ik toon de normale cameraview.': {
		de: 'Advanced Camera Card konnte nicht geladen werden. Die normale Kameraansicht wird angezeigt.',
		fr: 'Advanced Camera Card n’a pas pu être chargée. La vue caméra normale est affichée.',
		es: 'No se pudo cargar Advanced Camera Card. Se muestra la vista de cámara normal.'
	},
	'Bewerk hoe deze kaart leest en weergeeft': {
		de: 'Bearbeite, wie diese Karte Daten liest und darstellt',
		fr: 'Modifiez la façon dont cette carte lit et affiche les données',
		es: 'Edita cómo esta tarjeta lee y muestra los datos'
	},
	"Camera's selecteren en in Apple Home stijl tonen": {
		de: 'Kameras auswählen und im Apple-Home-Stil anzeigen',
		fr: 'Sélectionner des caméras et les afficher façon Apple Home',
		es: 'Seleccionar cámaras y mostrarlas al estilo Apple Home'
	},
	'Weekkalender met CalDAV personen en kleuren': {
		de: 'Wochenkalender mit CalDAV-Personen und Farben',
		fr: 'Calendrier hebdomadaire avec personnes CalDAV et couleurs',
		es: 'Calendario semanal con personas CalDAV y colores'
	},
	'Lampknop met helderheid en kleur': {
		de: 'Lichttaste mit Helligkeit und Farbe',
		fr: 'Bouton de lumière avec luminosité et couleur',
		es: 'Botón de luz con brillo y color'
	},
	'Thermostaatknop met temperatuur en modus': {
		de: 'Thermostattaste mit Temperatur und Modus',
		fr: 'Bouton thermostat avec température et mode',
		es: 'Botón de termostato con temperatura y modo'
	},
	'Gordijnknop met positiebediening': {
		de: 'Cover-Taste mit Positionssteuerung',
		fr: 'Bouton de volet avec commande de position',
		es: 'Botón de persiana con control de posición'
	},
	'Robotstofzuiger met start, pauze en dock': {
		de: 'Saugroboter mit Start, Pause und Dock',
		fr: 'Aspirateur robot avec démarrage, pause et retour à la base',
		es: 'Robot aspirador con inicio, pausa y base'
	},
	'Media player met afspelen en volume': {
		de: 'Mediaplayer mit Wiedergabe und Lautstärke',
		fr: 'Lecteur multimédia avec lecture et volume',
		es: 'Reproductor multimedia con reproducción y volumen'
	},
	'Koppel aan een alarm-entiteit': {
		de: 'Mit einer Alarm-Entität verknüpfen',
		fr: 'Associer à une entité d’alarme',
		es: 'Vincular a una entidad de alarma'
	},
	'Alarm-entiteit': { de: 'Alarm-Entität', fr: 'Entité d’alarme', es: 'Entidad de alarma' },
	'Weer-entiteit': { de: 'Wetter-Entität', fr: 'Entité météo', es: 'Entidad meteorológica' },
	gekoppeld: { de: 'verknüpft', fr: 'lié', es: 'vinculado' },
	'Selecteer het alarm_control_panel uit Home Assistant.': {
		de: 'Wähle das alarm_control_panel aus Home Assistant.',
		fr: 'Sélectionnez le alarm_control_panel dans Home Assistant.',
		es: 'Selecciona el alarm_control_panel de Home Assistant.'
	},
	'Selecteer een weer-entiteit uit Home Assistant.': {
		de: 'Wähle eine Wetter-Entität aus Home Assistant.',
		fr: 'Sélectionnez une entité météo dans Home Assistant.',
		es: 'Selecciona una entidad meteorológica de Home Assistant.'
	},
	'Kies uit beschikbare entiteiten': {
		de: 'Aus verfügbaren Entitäten wählen',
		fr: 'Choisir parmi les entités disponibles',
		es: 'Elegir entre entidades disponibles'
	},
	'Of typ handmatig': {
		de: 'Oder manuell eingeben',
		fr: 'Ou saisir manuellement',
		es: 'O escribir manualmente'
	},
	'Selecteer welke lampen meedoen': {
		de: 'Wähle aus, welche Lichter teilnehmen',
		fr: 'Sélectionnez les lumières à inclure',
		es: 'Selecciona qué luces participan'
	},
	'Stijl en weergave': { de: 'Stil und Anzeige', fr: 'Style et affichage', es: 'Estilo y visualización' },
	'Kies wat de klok toont: digitaal, analoog of beide.': {
		de: 'Wähle, was die Uhr zeigt: digital, analog oder beides.',
		fr: 'Choisissez ce que l’horloge affiche : numérique, analogique ou les deux.',
		es: 'Elige qué muestra el reloj: digital, analógico o ambos.'
	},
	'Live voorbeeld': { de: 'Live-Vorschau', fr: 'Aperçu en direct', es: 'Vista previa en directo' },
	'Kies een speler in het tabblad Spelers': {
		de: 'Wähle einen Player im Tab Spieler',
		fr: 'Choisissez un lecteur dans l’onglet Lecteurs',
		es: 'Elige un reproductor en la pestaña Reproductores'
	},
	'Verbind Novapanel met je Spotify-account om afspeellijsten en zoekresultaten te zien.': {
		de: 'Verbinde Novapanel mit deinem Spotify-Konto, um Playlists und Suchergebnisse zu sehen.',
		fr: 'Connectez Novapanel à votre compte Spotify pour voir les playlists et les résultats de recherche.',
		es: 'Conecta Novapanel con tu cuenta de Spotify para ver listas de reproducción y resultados de búsqueda.'
	},
	'Verbinden met Spotify': {
		de: 'Mit Spotify verbinden',
		fr: 'Se connecter à Spotify',
		es: 'Conectar con Spotify'
	},
	'Voltooi de Spotify-koppeling in het nieuwe tabblad. Deze pagina pikt het automatisch op.': {
		de: 'Schließe die Spotify-Verknüpfung im neuen Tab ab. Diese Seite erkennt sie automatisch.',
		fr: 'Terminez la connexion Spotify dans le nouvel onglet. Cette page la détectera automatiquement.',
		es: 'Completa la vinculación de Spotify en la nueva pestaña. Esta página la detectará automáticamente.'
	},
	'Kies speelapparaat…': {
		de: 'Wiedergabegerät wählen…',
		fr: 'Choisir un appareil de lecture…',
		es: 'Elegir dispositivo de reproducción…'
	},
	'Radio favorieten': { de: 'Radiofavoriten', fr: 'Favoris radio', es: 'Favoritos de radio' },
	'Stations zoeken': { de: 'Sender suchen', fr: 'Rechercher des stations', es: 'Buscar emisoras' },
	'Eigen URL': { de: 'Eigene URL', fr: 'URL personnalisée', es: 'URL personalizada' },
	'Eigen stream-URL toevoegen': {
		de: 'Eigene Stream-URL hinzufügen',
		fr: 'Ajouter une URL de flux personnalisée',
		es: 'Añadir URL de stream personalizada'
	},
	'Naam wijzigen': { de: 'Namen ändern', fr: 'Modifier le nom', es: 'Cambiar nombre' },
	'Verslepen om te herordenen': {
		de: 'Ziehen zum Neuordnen',
		fr: 'Faire glisser pour réordonner',
		es: 'Arrastrar para reordenar'
	},
	'Sleep om volgorde te wijzigen': {
		de: 'Ziehen, um die Reihenfolge zu ändern',
		fr: 'Faites glisser pour modifier l’ordre',
		es: 'Arrastra para cambiar el orden'
	},
	'Stream-URL': { de: 'Stream-URL', fr: 'URL du flux', es: 'URL del stream' },
	'Nog geen zones. Voeg er hieronder een toe.': {
		de: 'Noch keine Zonen. Füge unten eine hinzu.',
		fr: 'Aucune zone pour l’instant. Ajoutez-en une ci-dessous.',
		es: 'Aún no hay zonas. Añade una abajo.'
	},
	'+ Zone toevoegen…': { de: '+ Zone hinzufügen…', fr: '+ Ajouter une zone…', es: '+ Añadir zona…' },
	'Verwijderen uit favorieten': {
		de: 'Aus Favoriten entfernen',
		fr: 'Retirer des favoris',
		es: 'Eliminar de favoritos'
	},
	'Aan favorieten toevoegen': {
		de: 'Zu Favoriten hinzufügen',
		fr: 'Ajouter aux favoris',
		es: 'Añadir a favoritos'
	},
	'Nog geen favorieten. Klik op het zoek-icon hierboven om stations te zoeken via TuneIn, of op het link-icon om je eigen stream-URL toe te voegen.':
		{
			de: 'Noch keine Favoriten. Klicke oben auf das Suchsymbol, um Sender über TuneIn zu suchen, oder auf das Link-Symbol, um eine eigene Stream-URL hinzuzufügen.',
			fr: 'Aucun favori pour l’instant. Cliquez sur l’icône de recherche ci-dessus pour chercher des stations via TuneIn, ou sur l’icône de lien pour ajouter votre propre URL de flux.',
			es: 'Aún no hay favoritos. Haz clic en el icono de búsqueda de arriba para buscar emisoras en TuneIn, o en el icono de enlace para añadir tu propia URL de stream.'
		},
	'Spotify gaf "te veel verzoeken" terug. Novapanel pauzeert nu een minuut en probeert daarna automatisch opnieuw.':
		{
			de: 'Spotify meldete „zu viele Anfragen“. Novapanel pausiert jetzt eine Minute und versucht es danach automatisch erneut.',
			fr: 'Spotify a renvoyé « trop de requêtes ». Novapanel met en pause pendant une minute puis réessaie automatiquement.',
			es: 'Spotify devolvió “demasiadas solicitudes”. Novapanel pausa un minuto y después vuelve a intentarlo automáticamente.'
		},
	'Geen actief Spotify-apparaat. Kies eerst een apparaat in de "Spotify-apparaat"-lijst hierboven, of zet je Onkyo aan en schakel naar de Spotify-bron — dan verschijnt hij in de lijst.':
		{
			de: 'Kein aktives Spotify-Gerät. Wähle zuerst ein Gerät in der Liste „Spotify-Gerät“ oben, oder schalte deinen Onkyo ein und wechsle zur Spotify-Quelle — dann erscheint er in der Liste.',
			fr: 'Aucun appareil Spotify actif. Choisissez d’abord un appareil dans la liste « appareil Spotify » ci-dessus, ou allumez votre Onkyo et passez sur la source Spotify — il apparaîtra alors dans la liste.',
			es: 'No hay ningún dispositivo Spotify activo. Elige primero un dispositivo en la lista “dispositivo Spotify” de arriba, o enciende tu Onkyo y cambia a la fuente Spotify; entonces aparecerá en la lista.'
		},
	'Voor afspelen via Spotify Connect heb je een Spotify Premium-abonnement nodig.': {
		de: 'Für die Wiedergabe über Spotify Connect brauchst du ein Spotify-Premium-Abo.',
		fr: 'La lecture via Spotify Connect nécessite un abonnement Spotify Premium.',
		es: 'Para reproducir mediante Spotify Connect necesitas una suscripción a Spotify Premium.'
	},
	'Dit apparaat kan niet via Spotify Connect bediend worden.': {
		de: 'Dieses Gerät kann nicht über Spotify Connect gesteuert werden.',
		fr: 'Cet appareil ne peut pas être contrôlé via Spotify Connect.',
		es: 'Este dispositivo no se puede controlar mediante Spotify Connect.'
	},
	'Deze actie is niet beschikbaar in de huidige afspeel-context.': {
		de: 'Diese Aktion ist im aktuellen Wiedergabekontext nicht verfügbar.',
		fr: 'Cette action n’est pas disponible dans le contexte de lecture actuel.',
		es: 'Esta acción no está disponible en el contexto de reproducción actual.'
	},
	'Spotify staat al op pauze.': {
		de: 'Spotify ist bereits pausiert.',
		fr: 'Spotify est déjà en pause.',
		es: 'Spotify ya está en pausa.'
	},
	'Spotify is al aan het afspelen.': {
		de: 'Spotify spielt bereits.',
		fr: 'Spotify est déjà en lecture.',
		es: 'Spotify ya está reproduciendo.'
	},
	'Spotify gaf een onbekende fout terug. Probeer opnieuw of selecteer een ander apparaat.': {
		de: 'Spotify gab einen unbekannten Fehler zurück. Versuche es erneut oder wähle ein anderes Gerät.',
		fr: 'Spotify a renvoyé une erreur inconnue. Réessayez ou sélectionnez un autre appareil.',
		es: 'Spotify devolvió un error desconocido. Inténtalo de nuevo o selecciona otro dispositivo.'
	},
	'Geen geldige MA-speler geselecteerd.': {
		de: 'Kein gültiger MA-Player ausgewählt.',
		fr: 'Aucun lecteur MA valide sélectionné.',
		es: 'No se ha seleccionado un reproductor MA válido.'
	},
	'Geselecteerde speler niet meer beschikbaar.': {
		de: 'Der ausgewählte Player ist nicht mehr verfügbar.',
		fr: 'Le lecteur sélectionné n’est plus disponible.',
		es: 'El reproductor seleccionado ya no está disponible.'
	},
	'Spotify-verbinding is verlopen. Open Settings en verbind opnieuw.': {
		de: 'Die Spotify-Verbindung ist abgelaufen. Öffne Settings und verbinde erneut.',
		fr: 'La connexion Spotify a expiré. Ouvrez Settings et reconnectez-vous.',
		es: 'La conexión de Spotify ha caducado. Abre Settings y vuelve a conectar.'
	},
	'Spotify heeft deze actie geweigerd. Mogelijk geen Premium of geen rechten op dit apparaat.': {
		de: 'Spotify hat diese Aktion abgelehnt. Möglicherweise fehlt Premium oder die Berechtigung für dieses Gerät.',
		fr: 'Spotify a refusé cette action. Il manque peut-être Premium ou l’autorisation pour cet appareil.',
		es: 'Spotify ha rechazado esta acción. Puede que falte Premium o permisos para este dispositivo.'
	},
	'Te veel verzoeken naar Spotify. Wacht een paar tellen en probeer opnieuw.': {
		de: 'Zu viele Anfragen an Spotify. Warte einen Moment und versuche es erneut.',
		fr: 'Trop de requêtes vers Spotify. Attendez quelques instants puis réessayez.',
		es: 'Demasiadas solicitudes a Spotify. Espera unos segundos e inténtalo de nuevo.'
	},
	'Geen actief Spotify-apparaat. Kies eerst een apparaat in de lijst hierboven.': {
		de: 'Kein aktives Spotify-Gerät. Wähle zuerst ein Gerät in der Liste oben.',
		fr: 'Aucun appareil Spotify actif. Choisissez d’abord un appareil dans la liste ci-dessus.',
		es: 'No hay ningún dispositivo Spotify activo. Elige primero un dispositivo en la lista de arriba.'
	},
	'Er ging iets mis bij Spotify. Probeer het opnieuw.': {
		de: 'Bei Spotify ist etwas schiefgelaufen. Versuche es erneut.',
		fr: 'Un problème est survenu avec Spotify. Réessayez.',
		es: 'Algo ha ido mal con Spotify. Inténtalo de nuevo.'
	},
	'Spotify-auth start mislukte': {
		de: 'Spotify-Auth-Start fehlgeschlagen',
		fr: 'Échec du démarrage de l’authentification Spotify',
		es: 'Error al iniciar la autenticación de Spotify'
	},
	'Geen auth-URL ontvangen.': {
		de: 'Keine Auth-URL empfangen.',
		fr: 'Aucune URL d’authentification reçue.',
		es: 'No se recibió ninguna URL de autenticación.'
	},
	'Geen Spotify-controller in Home Assistant gevonden om naar de Onkyo door te schakelen.': {
		de: 'Kein Spotify-Controller in Home Assistant gefunden, um auf den Onkyo umzuschalten.',
		fr: 'Aucun contrôleur Spotify trouvé dans Home Assistant pour basculer vers l’Onkyo.',
		es: 'No se encontró ningún controlador de Spotify en Home Assistant para cambiar al Onkyo.'
	},
	'Kies eerst een speelapparaat in de dropdown hierboven.': {
		de: 'Wähle zuerst ein Wiedergabegerät im Dropdown oben.',
		fr: 'Choisissez d’abord un appareil de lecture dans la liste ci-dessus.',
		es: 'Elige primero un dispositivo de reproducción en el desplegable de arriba.'
	},
	'Onkyo niet zichtbaar in Spotify Connect — speel eerst iets af om de bridge te activeren.': {
		de: 'Onkyo ist in Spotify Connect nicht sichtbar — spiele zuerst etwas ab, um die Bridge zu aktivieren.',
		fr: 'Onkyo n’est pas visible dans Spotify Connect — lancez d’abord une lecture pour activer le pont.',
		es: 'Onkyo no aparece en Spotify Connect; reproduce algo primero para activar el puente.'
	},
	'Kies eerst een speler hierboven.': {
		de: 'Wähle zuerst oben einen Player.',
		fr: 'Choisissez d’abord un lecteur ci-dessus.',
		es: 'Elige primero un reproductor arriba.'
	},
	'Welke entiteiten': { de: 'Welche Entitäten', fr: 'Quelles entités', es: 'Qué entidades' },
	'Kies de domeinen die meetellen, en/of selecteer specifieke entiteiten handmatig.': {
		de: 'Wähle die Domänen, die mitzählen, und/oder wähle bestimmte Entitäten manuell aus.',
		fr: 'Choisissez les domaines à inclure et/ou sélectionnez manuellement des entités spécifiques.',
		es: 'Elige los dominios que cuentan y/o selecciona entidades específicas manualmente.'
	},
	'komma-gescheiden': { de: 'kommagetrennt', fr: 'séparé par des virgules', es: 'separado por comas' },
	'MDI naam, bv. lightbulb': {
		de: 'MDI-Name, z. B. lightbulb',
		fr: 'Nom MDI, par ex. lightbulb',
		es: 'Nombre MDI, p. ej. lightbulb'
	},
	'Optioneel. Beperk tot specifieke device classes (door, window, garage…).': {
		de: 'Optional. Auf bestimmte Geräteklassen begrenzen (door, window, garage…).',
		fr: 'Facultatif. Limitez à des classes d’appareil spécifiques (door, window, garage…).',
		es: 'Opcional. Limita a clases de dispositivo específicas (door, window, garage…).'
	},
	'Welke deuren en ramen zijn open': {
		de: 'Welche Türen und Fenster sind offen',
		fr: 'Quelles portes et fenêtres sont ouvertes',
		es: 'Qué puertas y ventanas están abiertas'
	},
	'Welke apparaten staan aan': {
		de: 'Welche Geräte sind eingeschaltet',
		fr: 'Quels appareils sont allumés',
		es: 'Qué dispositivos están encendidos'
	},
	'Welke apparaten zijn bereikbaar': {
		de: 'Welche Geräte sind erreichbar',
		fr: 'Quels appareils sont joignables',
		es: 'Qué dispositivos están disponibles'
	},
	'Welke spelers worden gevolgd': {
		de: 'Welche Player werden verfolgt',
		fr: 'Quels lecteurs sont suivis',
		es: 'Qué reproductores se siguen'
	},
	'Welke lampen zijn aan': {
		de: 'Welche Lichter sind an',
		fr: 'Quelles lumières sont allumées',
		es: 'Qué luces están encendidas'
	},
	'Bereikbaarheid en batterijen': {
		de: 'Erreichbarkeit und Batterien',
		fr: 'Disponibilité et batteries',
		es: 'Disponibilidad y baterías'
	},
	'Spelers en queue': {
		de: 'Player und Warteschlange',
		fr: 'Lecteurs et file d’attente',
		es: 'Reproductores y cola'
	},
	'Stijl en weergave van de klok': {
		de: 'Stil und Anzeige der Uhr',
		fr: 'Style et affichage de l’horloge',
		es: 'Estilo y visualización del reloj'
	},
	'Datumweergave instellen': {
		de: 'Datumsanzeige konfigurieren',
		fr: 'Configurer l’affichage de la date',
		es: 'Configurar la visualización de la fecha'
	},
	'Koppel aan een weer-entiteit': {
		de: 'Mit einer Wetter-Entität verknüpfen',
		fr: 'Associer à une entité météo',
		es: 'Vincular a una entidad meteorológica'
	},
	'Voorspelling weergeven': {
		de: 'Vorhersage anzeigen',
		fr: 'Afficher les prévisions',
		es: 'Mostrar previsión'
	},
	'geen apparaten': { de: 'keine Geräte', fr: 'aucun appareil', es: 'sin dispositivos' },
	'kWh-teller': { de: 'kWh-Zähler', fr: 'compteur kWh', es: 'contador kWh' },
	'kWh-tellers': { de: 'kWh-Zähler', fr: 'compteurs kWh', es: 'contadores kWh' },
	'volledig aangepast': {
		de: 'vollständig angepasst',
		fr: 'entièrement personnalisé',
		es: 'totalmente personalizado'
	},
	'Optioneel. Bedragen in euro per kWh-stand vandaag.': {
		de: 'Optional. Beträge in Euro pro heutigem kWh-Zählerstand.',
		fr: 'Facultatif. Montants en euros par relevé kWh du jour.',
		es: 'Opcional. Importes en euros por lectura kWh de hoy.'
	},
	'Eigen foto': { de: 'Eigenes Foto', fr: 'Photo personnalisée', es: 'Foto propia' },
	'Overdag, geen auto': { de: 'Tagsüber, kein Auto', fr: 'Journée, sans voiture', es: 'De día, sin coche' },
	'Overdag, met auto': { de: 'Tagsüber, mit Auto', fr: 'Journée, avec voiture', es: 'De día, con coche' },
	"'s Avonds, geen auto": {
		de: 'Abends, kein Auto',
		fr: 'Le soir, sans voiture',
		es: 'Por la noche, sin coche'
	},
	"'s Avonds, met auto": {
		de: 'Abends, mit Auto',
		fr: 'Le soir, avec voiture',
		es: 'Por la noche, con coche'
	},
	'Foto wijzig': { de: 'Foto ändern', fr: 'Modifier la photo', es: 'Cambiar foto' },
	'Foto…': { de: 'Foto…', fr: 'Photo…', es: 'Foto…' },
	'Ankers ✓': { de: 'Anker ✓', fr: 'Ancres ✓', es: 'Anclajes ✓' },
	'Ankers…': { de: 'Anker…', fr: 'Ancres…', es: 'Anclajes…' },
	Leeslamp: { de: 'Leselampe', fr: 'Lampe de lecture', es: 'Lámpara de lectura' },
	Woonkamer: { de: 'Wohnzimmer', fr: 'Salon', es: 'Salón' },
	Voordeur: { de: 'Haustür', fr: 'Porte d’entrée', es: 'Puerta principal' },
	'Auto-laadpunt': { de: 'Auto-Ladepunkt', fr: 'Point de recharge voiture', es: 'Punto de carga del coche' },
	'Straat / net': { de: 'Straße / Netz', fr: 'Rue / réseau', es: 'Calle / red' },
	'Rail (fallback)': { de: 'Schiene (Fallback)', fr: 'Rail (secours)', es: 'Riel (fallback)' },
	'Zon → Accu': { de: 'Sonne → Akku', fr: 'Soleil → Batterie', es: 'Sol → Batería' },
	'Zon → Auto': { de: 'Sonne → Auto', fr: 'Soleil → Voiture', es: 'Sol → Coche' },
	'Zon → Huis': { de: 'Sonne → Haus', fr: 'Soleil → Maison', es: 'Sol → Casa' },
	'Zon → Net': { de: 'Sonne → Netz', fr: 'Soleil → Réseau', es: 'Sol → Red' },
	'Net → Huis': { de: 'Netz → Haus', fr: 'Réseau → Maison', es: 'Red → Casa' },
	'Net → Auto': { de: 'Netz → Auto', fr: 'Réseau → Voiture', es: 'Red → Coche' },
	'Net → Accu': { de: 'Netz → Akku', fr: 'Réseau → Batterie', es: 'Red → Batería' },
	'Accu → Huis': { de: 'Akku → Haus', fr: 'Batterie → Maison', es: 'Batería → Casa' },
	'Accu → Auto': { de: 'Akku → Auto', fr: 'Batterie → Voiture', es: 'Batería → Coche' },
	'Kaart bewerken': { de: 'Karte bearbeiten', fr: 'Modifier la carte', es: 'Editar tarjeta' }
};

function completePhraseTranslations(
	base: Record<string, Partial<Record<LanguageCode, string>>>,
	completions: Record<string, Partial<Record<LanguageCode, string>>>
): Record<string, Partial<Record<LanguageCode, string>>> {
	const merged: Record<string, Partial<Record<LanguageCode, string>>> = {};
	for (const [key, value] of Object.entries(base)) {
		merged[key] = { ...(completions[key] ?? {}), ...value };
	}
	for (const [key, value] of Object.entries(completions)) {
		if (!merged[key]) merged[key] = value;
	}
	for (const [key, value] of Object.entries(merged)) {
		const dutchText = value.nl ?? key;
		const fallbackText = value.en ?? dutchText;
		value.nl ??= dutchText;
		value.en ??= fallbackText;
		value.de ??= fallbackText;
		value.fr ??= fallbackText;
		value.es ??= fallbackText;
	}
	return merged;
}

const phraseTranslations = completePhraseTranslations(phraseTranslationsBase, phraseTranslationCompletions);
const requiredNativePhraseLanguages = ['de', 'fr', 'es'] as const;

export type NativePhraseTranslationGap = {
	key: string;
	missingLanguages: Array<(typeof requiredNativePhraseLanguages)[number]>;
};

export function getNativePhraseTranslationGaps(): NativePhraseTranslationGap[] {
	const gaps: NativePhraseTranslationGap[] = [];
	for (const [key, value] of Object.entries(phraseTranslationsBase)) {
		const merged = { ...(phraseTranslationCompletions[key] ?? {}), ...value };
		if (!merged.en) continue;
		const missingLanguages = requiredNativePhraseLanguages.filter(
			(language) => typeof merged[language] !== 'string' || merged[language]?.trim().length === 0
		);
		if (missingLanguages.length > 0) gaps.push({ key, missingLanguages: [...missingLanguages] });
	}
	return gaps;
}

const stateTranslations: Record<string, string> = {
	off: 'Uit',
	on: 'Aan',
	open: 'Open',
	closed: 'Dicht',
	opening: 'Opent',
	closing: 'Sluit',
	playing: 'Speelt',
	paused: 'Gepauzeerd',
	idle: 'Idle',
	docked: 'Docked',
	cleaning: 'Schoonmaken',
	returning: 'Terug naar dock',
	unavailable: 'Niet beschikbaar',
	unknown: 'Onbekend',
	home: 'Thuis',
	not_home: 'Niet thuis'
};

const localeMap: Record<LanguageCode, string> = {
	nl: 'nl-NL',
	en: 'en-US',
	de: 'de-DE',
	fr: 'fr-FR',
	es: 'es-ES'
};

function catalogFor(language: LanguageCode): Record<string, string> {
	return translations[language] as unknown as Record<string, string>;
}

export function isLanguageCode(value: unknown): value is LanguageCode {
	return typeof value === 'string' && value in translations;
}

export function localeFor(language: LanguageCode | undefined): string {
	return localeMap[language && isLanguageCode(language) ? language : DEFAULT_LANGUAGE];
}

export function setLanguage(language: LanguageCode) {
	selectedLanguageStore.set(language);
	if (browser) {
		localStorage.setItem(STORAGE_KEY, language);
		document.documentElement.lang = language;
	}
}

export function loadStoredLanguage(fallback: LanguageCode = 'nl'): LanguageCode {
	return initialSelectedLanguage(fallback);
}

export function translate(key: TranslationKey | string, language: LanguageCode = DEFAULT_LANGUAGE): string {
	const selected = isLanguageCode(language) ? language : DEFAULT_LANGUAGE;
	const phrase = phraseTranslations[key];
	if (selected === 'nl' && phrase) return phrase.nl ?? key;
	if (catalogFor(selected)[key]) return catalogFor(selected)[key];
	if (phrase?.[selected]) return phrase[selected] ?? key;
	if (phrase) return phrase.nl ?? key;
	return catalogFor(DEFAULT_LANGUAGE)[key] ?? phrase?.[DEFAULT_LANGUAGE] ?? key;
}

export function translateState(state: string | undefined, language: LanguageCode = DEFAULT_LANGUAGE): string {
	const normalized = (state ?? '').toLowerCase();
	const phrase = stateTranslations[normalized] ?? (state || 'Onbekend');
	return translate(phrase, language);
}
