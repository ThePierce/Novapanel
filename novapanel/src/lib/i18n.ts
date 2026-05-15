import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { languageOptions, translations, type LanguageCode, type TranslationKey } from './i18n-data';

export { languageOptions, translations };
export type { LanguageCode, TranslationKey };

const DEFAULT_LANGUAGE: LanguageCode = 'en';
const STORAGE_KEY = 'novapanel.language';

export const selectedLanguageStore = writable<LanguageCode>('nl');

const phraseTranslations: Record<string, Partial<Record<LanguageCode, string>>> = {
	'Lamp': { en: 'Light', de: 'Licht', fr: 'Lumière', es: 'Luz' },
	'Lampen': { en: 'Lights', de: 'Lichter', fr: 'Lumières', es: 'Luces' },
	'Gordijn': { en: 'Cover', de: 'Abdeckung', fr: 'Volet', es: 'Persiana' },
	'Stofzuiger': { en: 'Vacuum', de: 'Staubsauger', fr: 'Aspirateur', es: 'Aspiradora' },
	'Media player': { en: 'Media player', de: 'Mediaplayer', fr: 'Lecteur multimédia', es: 'Reproductor multimedia' },
	'Apparaten': { en: 'Devices', de: 'Geräte', fr: 'Appareils', es: 'Dispositivos' },
	'Media Spelers': { en: 'Media players', de: 'Mediaplayer', fr: 'Lecteurs multimédia', es: 'Reproductores multimedia' },
	'Overig': { en: 'Other', de: 'Sonstiges', fr: 'Autre', es: 'Otros' },
	'Aan': { en: 'On', de: 'Ein', fr: 'Allumé', es: 'Encendido' },
	'Uit': { en: 'Off', de: 'Aus', fr: 'Éteint', es: 'Apagado' },
	'Uitgeschakeld': { en: 'Disarmed', de: 'Deaktiviert', fr: 'Désarmé', es: 'Desactivado' },
	'Wordt ingeschakeld…': { en: 'Arming…', de: 'Wird aktiviert…', fr: 'Armement…', es: 'Activando…' },
	'In afwachting': { en: 'Pending', de: 'Ausstehend', fr: 'En attente', es: 'Pendiente' },
	'Ingeschakeld': { en: 'Armed', de: 'Aktiviert', fr: 'Armé', es: 'Activado' },
	'Weg': { en: 'Away', de: 'Abwesend', fr: 'Absent', es: 'Fuera' },
	'Nacht': { en: 'Night', de: 'Nacht', fr: 'Nuit', es: 'Noche' },
	'Open': { en: 'Open', de: 'Offen', fr: 'Ouvert', es: 'Abierto' },
	'Dicht': { en: 'Closed', de: 'Geschlossen', fr: 'Fermé', es: 'Cerrado' },
	'Opent': { en: 'Opening', de: 'Öffnet', fr: 'Ouverture', es: 'Abriendo' },
	'Sluit': { en: 'Closing', de: 'Schließt', fr: 'Fermeture', es: 'Cerrando' },
	'Speelt': { en: 'Playing', de: 'Wiedergabe', fr: 'Lecture', es: 'Reproduciendo' },
	'Gepauzeerd': { en: 'Paused', de: 'Pausiert', fr: 'En pause', es: 'Pausado' },
	'Schoonmaken': { en: 'Cleaning', de: 'Reinigt', fr: 'Nettoyage', es: 'Limpiando' },
	'Terug naar dock': { en: 'Returning to dock', de: 'Zurück zur Basis', fr: 'Retour à la base', es: 'Volviendo a la base' },
	'Onbekend': { en: 'Unknown', de: 'Unbekannt', fr: 'Inconnu', es: 'Desconocido' },
	'Niet beschikbaar': { en: 'Unavailable', de: 'Nicht verfügbar', fr: 'Indisponible', es: 'No disponible' },
	'Geen data': { en: 'No data', de: 'Keine Daten', fr: 'Aucune donnée', es: 'Sin datos' },
	'Geen lamp gekoppeld': { en: 'No light linked', de: 'Kein Licht verknüpft', fr: 'Aucune lumière liée', es: 'Ninguna luz vinculada' },
	'Geen entiteit gekoppeld': { en: 'No entity linked', de: 'Keine Entität verknüpft', fr: 'Aucune entité liée', es: 'Ninguna entidad vinculada' },
	'Geen entiteit ingesteld': { en: 'No entity configured', de: 'Keine Entität konfiguriert', fr: 'Aucune entité configurée', es: 'Ninguna entidad configurada' },
	'Sensor geeft geen getal': { en: 'Sensor is not numeric' },
	'Niet gevonden': { en: 'Not found', de: 'Nicht gefunden', fr: 'Introuvable', es: 'No encontrado' },
	'Energie': { en: 'Energy', de: 'Energie', fr: 'Énergie', es: 'Energía' },
	'Energieoverzicht': { en: 'Energy overview' },
	'Opwek': { en: 'Production', de: 'Erzeugung', fr: 'Production', es: 'Producción' },
	'Zelfvoorzienend': { en: 'Self-sufficient', de: 'Autark', fr: 'Autosuffisant', es: 'Autosuficiente' },
	'Net': { en: 'Grid', de: 'Netz', fr: 'Réseau', es: 'Red' },
	'Kosten': { en: 'Costs', de: 'Kosten', fr: 'Coûts', es: 'Costes' },
	'Teruglevering': { en: 'Export', de: 'Einspeisung', fr: 'Retour réseau', es: 'Exportación' },
	'Afname': { en: 'Import', de: 'Bezug', fr: 'Prélèvement', es: 'Importación' },
	'In balans': { en: 'Balanced', de: 'Ausgeglichen', fr: 'Équilibré', es: 'En equilibrio' },
	'Bekijk verbruik per apparaat': { en: 'View consumption per device' },
	'Verbruik per apparaat': { en: 'Consumption per device' },
	'Live': { en: 'Live', de: 'Live', fr: 'Live', es: 'En vivo' },
	'vandaag': { en: 'today', de: 'heute', fr: 'aujourd’hui', es: 'hoy' },
	'Live verbruik': { en: 'Live consumption' },
	'apparaten actief': { en: 'devices active' },
	'sinds 00:00': { en: 'since 00:00' },
	'Huidig verbruik': { en: 'Current consumption' },
	'Geen apparaten geconfigureerd.': { en: 'No devices configured.' },
	'Alle apparaten verborgen — klik er hieronder eentje aan.': { en: 'All devices hidden — click one below.' },
	'terug': { en: 'export', de: 'Einspeisung', fr: 'retour', es: 'exportación' },
	'Geen verbruik': { en: 'No consumption', de: 'Kein Verbrauch', fr: 'Aucune consommation', es: 'Sin consumo' },
	'afname': { en: 'import', de: 'Bezug', fr: 'prélèvement', es: 'importación' },
	'lamp aan': { en: 'light on' },
	'lampen aan': { en: 'lights on' },
	'Alle lampen uit': { en: 'All lights off' },
	'van totaal': { en: 'of total' },
	'Alles dicht': { en: 'Everything closed' },
	'apparaat actief': { en: 'device active' },
	'Alle apparaten uit': { en: 'All devices off' },
	'Niet bereikbaar': { en: 'Unreachable' },
	'Afspelen': { en: 'Playing' },
	'Inactief': { en: 'Idle' },
	'Verwarmen': { en: 'Heating' },
	'Koelen': { en: 'Cooling' },
	'Gesloten': { en: 'Closed' },
	'Actie mislukt': { en: 'Action failed', de: 'Aktion fehlgeschlagen', fr: 'Action échouée', es: 'Acción fallida' },
	'Helderheid': { en: 'Brightness', de: 'Helligkeit', fr: 'Luminosité', es: 'Brillo' },
	'procent': { en: 'percent', de: 'Prozent', fr: 'pour cent', es: 'por ciento' },
	'uitzetten': { en: 'turn off', de: 'ausschalten', fr: 'éteindre', es: 'apagar' },
	'aanzetten': { en: 'turn on', de: 'einschalten', fr: 'allumer', es: 'encender' },
	'Kleuren': { en: 'Colors', de: 'Farben', fr: 'Couleurs', es: 'Colores' },
	'Warm wit': { en: 'Warm white', de: 'Warmweiß', fr: 'Blanc chaud', es: 'Blanco cálido' },
	'Zacht warm': { en: 'Soft warm', de: 'Weich warm', fr: 'Chaud doux', es: 'Cálido suave' },
	'Oranje': { en: 'Orange', de: 'Orange', fr: 'Orange', es: 'Naranja' },
	'Paars': { en: 'Purple', de: 'Lila', fr: 'Violet', es: 'Morado' },
	'Helder wit': { en: 'Bright white', de: 'Helles Weiß', fr: 'Blanc lumineux', es: 'Blanco brillante' },
	'Wittemperatuur': { en: 'White temperature', de: 'Weißtemperatur', fr: 'Température du blanc', es: 'Temperatura de blanco' },
	'Warm': { en: 'Warm', de: 'Warm', fr: 'Chaud', es: 'Cálido' },
	'Neutraal': { en: 'Neutral', de: 'Neutral', fr: 'Neutre', es: 'Neutro' },
	'Koel': { en: 'Cool', de: 'Kühl', fr: 'Froid', es: 'Frío' },
	'Climate': { en: 'Climate', de: 'Klima', fr: 'Climat', es: 'Clima' },
	'Doel': { en: 'Target', de: 'Ziel', fr: 'Cible', es: 'Objetivo' },
	'doel': { en: 'target', de: 'Ziel', fr: 'cible', es: 'objetivo' },
	'Nu': { en: 'Now', de: 'Jetzt', fr: 'Maintenant', es: 'Ahora' },
	'Doeltemperatuur': { en: 'Target temperature', de: 'Zieltemperatur', fr: 'Température cible', es: 'Temperatura objetivo' },
	'Modus': { en: 'Mode', de: 'Modus', fr: 'Mode', es: 'Modo' },
	'Preset': { en: 'Preset', de: 'Preset', fr: 'Préréglage', es: 'Preajuste' },
	'Geen preset': { en: 'No preset', de: 'Kein Preset', fr: 'Aucun préréglage', es: 'Sin preajuste' },
	'Status': { en: 'Status', de: 'Status', fr: 'Statut', es: 'Estado' },
	'Batterij': { en: 'Battery', de: 'Batterie', fr: 'Batterie', es: 'Batería' },
	'Pauze': { en: 'Pause', de: 'Pause', fr: 'Pause', es: 'Pausa' },
	'Dock': { en: 'Dock', de: 'Dock', fr: 'Base', es: 'Base' },
	'Zoek': { en: 'Find', de: 'Suchen', fr: 'Trouver', es: 'Buscar' },
	'Zuigkracht': { en: 'Suction power', de: 'Saugkraft', fr: 'Puissance', es: 'Potencia' },
	'Vorige': { en: 'Previous', de: 'Zurück', fr: 'Précédent', es: 'Anterior' },
	'Volgende': { en: 'Next', de: 'Weiter', fr: 'Suivant', es: 'Siguiente' },
	'Pauzeren': { en: 'Pause', de: 'Pausieren', fr: 'Pause', es: 'Pausar' },
	'Aan/uit': { en: 'Power', de: 'Ein/Aus', fr: 'Marche/arrêt', es: 'Encendido/apagado' },
	'Actief': { en: 'Active', de: 'Aktiv', fr: 'Actif', es: 'Activo' },
	'Afspelen of pauzeren': { en: 'Play or pause', de: 'Abspielen oder pausieren', fr: 'Lire ou pause', es: 'Reproducir o pausar' },
	'Bron': { en: 'Source', de: 'Quelle', fr: 'Source', es: 'Fuente' },
	'Geen kaarten in deze sectie': { en: 'No cards in this section', de: 'Keine Karten in diesem Abschnitt', fr: 'Aucune carte dans cette section', es: 'No hay tarjetas en esta sección' },
	'Kies een entiteit': { en: 'Choose an entity', de: 'Entität wählen', fr: 'Choisir une entité', es: 'Elegir entidad' },
	'Kies een lamp': { en: 'Choose a light', de: 'Licht wählen', fr: 'Choisir une lumière', es: 'Elegir luz' },
	'Zoek in entiteiten...': { en: 'Search entities...', de: 'Entitäten suchen...', fr: 'Rechercher des entités...', es: 'Buscar entidades...' },
	'Zoekterm wissen': { en: 'Clear search', de: 'Suche löschen', fr: 'Effacer la recherche', es: 'Borrar búsqueda' },
	'Wis zoekopdracht': { en: 'Clear search', de: 'Suche löschen', fr: 'Effacer la recherche', es: 'Borrar búsqueda' },
	'Geen entiteiten gevonden voor je zoekopdracht.': { en: 'No entities found for your search.' },
	'Geen entiteiten beschikbaar.': { en: 'No entities available.' },
	'Geen kamer toegewezen': { en: 'No room assigned' },
	'Kamerinformatie laden…': { en: 'Loading room information…' },
	'actief': { en: 'active', de: 'aktiv', fr: 'actif', es: 'activo' },
	'van': { en: 'of', de: 'von', fr: 'sur', es: 'de' },
	'gevonden': { en: 'found', de: 'gefunden', fr: 'trouvés', es: 'encontrados' },
	'geen': { en: 'none', de: 'keine', fr: 'aucun', es: 'ninguno' },
	'alles aan': { en: 'select all', de: 'alle auswählen', fr: 'tout sélectionner', es: 'seleccionar todo' },
	'geselecteerd': { en: 'selected', de: 'ausgewählt', fr: 'sélectionné', es: 'seleccionado' },
	'alle': { en: 'all', de: 'alle', fr: 'tous', es: 'todos' },
	'wissen': { en: 'clear', de: 'löschen', fr: 'effacer', es: 'borrar' },
	'Lamp entiteit': { en: 'Light entity' },
	'Climate entiteit': { en: 'Climate entity' },
	'Cover entiteit': { en: 'Cover entity' },
	'Vacuum entiteit': { en: 'Vacuum entity' },
	'Media player entiteit': { en: 'Media player entity' },
	'MDI icoon': { en: 'MDI icon', de: 'MDI-Symbol', fr: 'Icône MDI', es: 'Icono MDI' },
	'Gebruik een Material Design Icon naam, bijvoorbeeld': { en: 'Use a Material Design Icon name, for example' },
	'Sla de kaart daarna op.': { en: 'Then save the card.' },
	'Popup icoon': { en: 'Popup icon', de: 'Popup-Symbol', fr: 'Icône de popup', es: 'Icono de popup' },
	'Header waarden': { en: 'Header metrics', de: 'Header-Werte', fr: 'Valeurs d’en-tête', es: 'Métricas de cabecera' },
	'Temperatuur': { en: 'Temperature', de: 'Temperatur', fr: 'Température', es: 'Temperatura' },
	'Luchtvochtigheid': { en: 'Humidity', de: 'Luftfeuchtigkeit', fr: 'Humidité', es: 'Humedad' },
	'Luchtdruk': { en: 'Pressure', de: 'Luftdruck', fr: 'Pression', es: 'Presión' },
	'Geen temperatuur': { en: 'No temperature', de: 'Keine Temperatur', fr: 'Aucune température', es: 'Sin temperatura' },
	'Geen luchtvochtigheid': { en: 'No humidity', de: 'Keine Luftfeuchtigkeit', fr: 'Aucune humidité', es: 'Sin humedad' },
	'Geen luchtdruk': { en: 'No pressure', de: 'Kein Luftdruck', fr: 'Aucune pression', es: 'Sin presión' },
	'Kaarten zichtbaar in sectie': { en: 'Cards visible in section', de: 'Sichtbare Karten im Abschnitt', fr: 'Cartes visibles dans la section', es: 'Tarjetas visibles en la sección' },
	'Weekkalender': { en: 'Week calendar', de: 'Wochenkalender', fr: 'Calendrier semaine', es: 'Calendario semanal' },
	'Kalenders': { en: 'Calendars', de: 'Kalender', fr: 'Calendriers', es: 'Calendarios' },
	'Kies CalDAV kalender-entiteiten, koppel optioneel een person-entiteit, geef iedere persoon een kleur en zet ze in de juiste volgorde.': {
		en: 'Choose CalDAV calendar entities, optionally link a person entity, give each person a color, and set the order.'
	},
	'Persoon toevoegen': { en: 'Add person', de: 'Person hinzufügen', fr: 'Ajouter une personne', es: 'Añadir persona' },
	'Nog geen kalenders geselecteerd. Je kunt ook handmatig een entity id invullen, bijvoorbeeld': {
		en: 'No calendars selected yet. You can also enter an entity ID manually, for example'
	},
	'Naam': { en: 'Name', de: 'Name', fr: 'Nom', es: 'Nombre' },
	'Kleur': { en: 'Color', de: 'Farbe', fr: 'Couleur', es: 'Color' },
	'Volgorde aanpassen': { en: 'Adjust order', de: 'Reihenfolge anpassen', fr: 'Ajuster l’ordre', es: 'Ajustar orden' },
	'Omhoog': { en: 'Move up', de: 'Nach oben', fr: 'Monter', es: 'Subir' },
	'Omlaag': { en: 'Move down', de: 'Nach unten', fr: 'Descendre', es: 'Bajar' },
	'Verwijderen': { en: 'Delete', de: 'Löschen', fr: 'Supprimer', es: 'Eliminar' },
	'Kies kalender-entiteiten in edit mode.': { en: 'Choose calendar entities in edit mode.', de: 'Kalender-Entitäten im Bearbeitungsmodus wählen.', fr: 'Choisissez les entités calendrier en mode édition.', es: 'Elige entidades de calendario en modo edición.' },
	'Hele dag': { en: 'All day', de: 'Ganztägig', fr: 'Toute la journée', es: 'Todo el día' },
	'Afspraak': { en: 'Event', de: 'Termin', fr: 'Événement', es: 'Evento' },
	'events': { nl: 'afspraken', en: 'events', de: 'Termine', fr: 'événements', es: 'eventos' },
	'Kalender laden...': { en: 'Loading calendar...', de: 'Kalender wird geladen...', fr: 'Chargement du calendrier...', es: 'Cargando calendario...' },
	'Kalender laden mislukt': { en: 'Calendar failed to load', de: 'Kalender konnte nicht geladen werden', fr: 'Échec du chargement du calendrier', es: 'No se pudo cargar el calendario' },
	'Locatie van': { en: 'Location of', de: 'Standort von', fr: 'Position de', es: 'Ubicación de' },
	'Locatie van iedereen': { en: 'Everyone’s location', de: 'Standort aller Personen', fr: 'Position de tout le monde', es: 'Ubicación de todos' },
	'Locatie onbekend': { en: 'Location unknown', de: 'Standort unbekannt', fr: 'Position inconnue', es: 'Ubicación desconocida' },
	'Thuis': { en: 'Home', de: 'Zuhause', fr: 'Maison', es: 'Casa' },
	'Niet thuis': { en: 'Away', de: 'Nicht zuhause', fr: 'Absent', es: 'Fuera' },
	'Geen locatie beschikbaar. Koppel een person-entiteit of controleer de locatie-attributen.': {
		en: 'No location available. Link a person entity or check the location attributes.',
		de: 'Kein Standort verfügbar. Verknüpfe eine Personen-Entität oder prüfe die Standortattribute.',
		fr: 'Aucune position disponible. Liez une entité person ou vérifiez les attributs de localisation.',
		es: 'No hay ubicación disponible. Vincula una entidad person o comprueba los atributos de ubicación.'
	},
	'met de auto naar huis': { en: 'by car to home', de: 'mit dem Auto nach Hause', fr: 'en voiture vers la maison', es: 'en coche a casa' },
	'met de fiets naar huis': { en: 'by bike to home', de: 'mit dem Fahrrad nach Hause', fr: 'à vélo vers la maison', es: 'en bici a casa' },
	'Sectie waarden': { en: 'Section metrics', de: 'Abschnittswerte', fr: 'Valeurs de section', es: 'Métricas de sección' },
	'Maak kleiner': { en: 'Collapse', de: 'Verkleinern', fr: 'Réduire', es: 'Reducir' },
	'Maak groter': { en: 'Expand', de: 'Vergrößern', fr: 'Agrandir', es: 'Ampliar' },
	'Personaliseer Novapanel': { en: 'Personalize Novapanel', de: 'Novapanel personalisieren', fr: 'Personnaliser Novapanel', es: 'Personalizar Novapanel' },
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
	'Deze redirect gebruikt nog de oude /local_novapanel-route. Novapanel vervangt dit bij verbinden automatisch door de callback-URL hieronder, maar plak die nieuwe URL ook in het Spotify Dashboard.': {
		en: 'This redirect still uses the old /local_novapanel route. Novapanel replaces it with the callback URL below when connecting, but also paste that new URL into the Spotify Dashboard.'
	},
	'Maak een gratis app aan op': {
		en: 'Create a free app at',
		de: 'Erstelle eine kostenlose App unter',
		fr: 'Créez une app gratuite sur',
		es: 'Crea una app gratuita en'
	},
	'Klik op Create app, vul een naam en omschrijving in, voeg de callback-URL hieronder toe bij Redirect URI, vink Web API aan en accepteer de voorwaarden. Kopieer daarna de Client ID uit het app-overzicht hierheen.': {
		en: 'Click Create app, enter a name and description, add the callback URL below under Redirect URI, select Web API, and accept the terms. Then copy the Client ID from the app overview into this field.'
	},
	'Open je app in het dashboard, klik op Settings en daarna op View client secret. Kopieer de Client Secret hierheen.': {
		en: 'Open your app in the dashboard, click Settings, then View client secret. Copy the Client Secret into this field.'
	},
	'Open je app op': { en: 'Open your app at', de: 'Öffne deine App unter', fr: 'Ouvrez votre app sur', es: 'Abre tu app en' },
	'open Settings en plak exact deze callback-URL bij Redirect URIs:': {
		en: 'open Settings and paste this exact callback URL under Redirect URIs:'
	},
	'Spotify vereist een exacte match en meestal HTTPS. Gebruik precies de URL hierboven; bij Home Assistant ingress hoort daar meestal': {
		en: 'Spotify requires an exact match and usually HTTPS. Use exactly the URL above; with Home Assistant ingress it usually should include'
	},
	'in te staan. Als Home Assistant later een andere ingress-token toont, kopieer dan de nieuwe callback-URL opnieuw naar Spotify.': {
		en: 'in it. If Home Assistant later shows a different ingress token, copy the new callback URL to Spotify again.'
	},
	'Klik daarna op Add en Save. Laat dit veld leeg om de automatisch herkende callback-URL te gebruiken.': {
		en: 'Then click Add and Save. Leave this field empty to use the automatically detected callback URL.'
	},
	'Gekopieerd': { en: 'Copied', de: 'Kopiert', fr: 'Copié', es: 'Copiado' },
	'Kopieer mijn callback-URL': { en: 'Copy my callback URL', de: 'Callback-URL kopieren', fr: 'Copier mon URL de callback', es: 'Copiar mi URL de callback' },
	'Bezig met verbinden…': { en: 'Connecting…', de: 'Verbinden…', fr: 'Connexion…', es: 'Conectando…' },
	'Status controleren': { en: 'Check status', de: 'Status prüfen', fr: 'Vérifier le statut', es: 'Comprobar estado' },
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
	'groot': { en: 'large', de: 'groß', fr: 'grand', es: 'grande' },
	"Voeg camera-entiteiten toe en bepaal welke groot worden weergegeven (Apple Home stijl). Zet Advanced Camera Card aan voor de HA custom-card; extra YAML is optioneel.": {
		en: 'Add camera entities and choose which ones are shown large (Apple Home style). Enable Advanced Camera Card for the HA custom card; extra YAML is optional.'
	},
	"Nog geen camera's geselecteerd.": { en: 'No cameras selected yet.' },
	'Naam (optioneel)': { en: 'Name (optional)', de: 'Name (optional)', fr: 'Nom (facultatif)', es: 'Nombre (opcional)' },
	'optioneel': { en: 'optional', de: 'optional', fr: 'facultatif', es: 'opcional' },
	'Groot weergeven': { en: 'Show large', de: 'Groß anzeigen', fr: 'Afficher en grand', es: 'Mostrar grande' },
	'Camera toevoegen': { en: 'Add camera', de: 'Kamera hinzufügen', fr: 'Ajouter une caméra', es: 'Añadir cámara' },
	'Alle camera-entiteiten zijn al toegevoegd.': { en: 'All camera entities have already been added.' },
	'Geen camera-entiteiten gevonden.': { en: 'No camera entities found.' },
	"Geen camera's geconfigureerd": { en: 'No cameras configured' },
	'Advanced Camera Card kon niet worden geladen. Ik toon de normale cameraview.': {
		en: 'Advanced Camera Card could not be loaded. Showing the normal camera view.'
	},
	'Geen beeld beschikbaar': { en: 'No image available' },
	'Voorspelling': { en: 'Forecast', de: 'Vorhersage', fr: 'Prévisions', es: 'Pronóstico' },
	'Welk type voorspelling en hoeveel dagen er getoond worden.': { en: 'Which forecast type and how many days are shown.' },
	'Dagen': { en: 'Days', de: 'Tage', fr: 'Jours', es: 'Días' },
	'Voorspelling voor de komende dagen': { en: 'Forecast for the coming days' },
	'Voorspelling laden…': { en: 'Loading forecast…' },
	'Uurlijks': { en: 'Hourly', de: 'Stündlich', fr: 'Horaire', es: 'Por hora' },
	'Uurvoorspelling laden…': { en: 'Loading hourly forecast…' },
	'Vandaag': { en: 'Today', de: 'Heute', fr: 'Aujourd’hui', es: 'Hoy' },
	'Vandaag-totalen': { en: 'Today totals' },
	'optioneel; anders berekend': { en: 'optional; otherwise calculated' },
	'Morgen': { en: 'Tomorrow', de: 'Morgen', fr: 'Demain', es: 'Mañana' },
	'Totaal': { en: 'Total', de: 'Gesamt', fr: 'Total', es: 'Total' },
	'Lampengroepen': { en: 'Light groups', de: 'Lichtgruppen', fr: 'Groupes de lumières', es: 'Grupos de luces' },
	'Groepen tellen als 1 item in het overzicht. Handig om "Woonkamer" als één entiteit te zien.': {
		en: 'Groups count as one item in the overview. Useful for showing “Living room” as a single entity.'
	},
	'Bewerken': { en: 'Edit', de: 'Bearbeiten', fr: 'Modifier', es: 'Editar' },
	'Nog geen lampen toegevoegd': { en: 'No lights added yet' },
	'meer': { en: 'more', de: 'mehr', fr: 'plus', es: 'más' },
	'Nieuwe groepsnaam': { en: 'New group name' },
	'Toevoegen': { en: 'Add', de: 'Hinzufügen', fr: 'Ajouter', es: 'Añadir' },
	'Bewerk hoe deze kaart leest en weergeeft': { en: 'Edit how this card reads and displays data' },
	"Camera's selecteren en in Apple Home stijl tonen": { en: 'Select cameras and show them in Apple Home style' },
	'Weekkalender met CalDAV personen en kleuren': { en: 'Week calendar with CalDAV people and colors' },
	'Lampknop met helderheid en kleur': { en: 'Light button with brightness and color' },
	'Thermostaatknop met temperatuur en modus': { en: 'Thermostat button with temperature and mode' },
	'Gordijnknop met positiebediening': { en: 'Cover button with position control' },
	'Robotstofzuiger met start, pauze en dock': { en: 'Robot vacuum with start, pause, and dock' },
	'Media player met afspelen en volume': { en: 'Media player with playback and volume' },
	'Koppel aan een alarm-entiteit': { en: 'Link an alarm entity' },
	'Alarm-entiteit': { en: 'Alarm entity' },
	'Weer-entiteit': { en: 'Weather entity' },
	'gekoppeld': { en: 'linked' },
	'Selecteer het alarm_control_panel uit Home Assistant.': { en: 'Select the alarm_control_panel from Home Assistant.' },
	'Selecteer een weer-entiteit uit Home Assistant.': { en: 'Select a weather entity from Home Assistant.' },
	'Kies uit beschikbare entiteiten': { en: 'Choose from available entities' },
	'Of typ handmatig': { en: 'Or type manually' },
	'Selecteer welke lampen meedoen': { en: 'Select which lights are included' },
	'Selecteer lampen voor deze groep': { en: 'Select lights for this group' },
	'Groepsnaam': { en: 'Group name' },
	'in andere groep': { en: 'in another group' },
	'Voeg eerst lampen toe via de entiteitenlijst hierboven.': { en: 'Add lights through the entity list above first.' },
	'Verwijder groep': { en: 'Delete group' },
	'Opslaan': { en: 'Save', de: 'Speichern', fr: 'Enregistrer', es: 'Guardar' },
	'Stijl en weergave': { en: 'Style and display' },
	'Kies wat de klok toont: digitaal, analoog of beide.': { en: 'Choose what the clock shows: digital, analog, or both.' },
	'Stijl': { en: 'Style', de: 'Stil', fr: 'Style', es: 'Estilo' },
	'Live voorbeeld': { en: 'Live preview' },
	'Kies een kaart om toe te voegen': { en: 'Choose a card to add' },
	'Kies een speler in het tabblad Spelers': { en: 'Choose a player in the Players tab' },
	'Spelers': { en: 'Players', de: 'Spieler', fr: 'Lecteurs', es: 'Reproductores' },
	'Verbind Novapanel met je Spotify-account om afspeellijsten en zoekresultaten te zien.': {
		en: 'Connect Novapanel to your Spotify account to see playlists and search results.'
	},
	'Verbinden met Spotify': { en: 'Connect to Spotify' },
	'Voltooi de Spotify-koppeling in het nieuwe tabblad. Deze pagina pikt het automatisch op.': {
		en: 'Complete the Spotify connection in the new tab. This page will pick it up automatically.'
	},
	'Kies speelapparaat…': { en: 'Choose playback device…' },
	'Radio favorieten': { en: 'Radio favorites' },
	'Zoeken': { en: 'Search', de: 'Suchen', fr: 'Rechercher', es: 'Buscar' },
	'Stations zoeken': { en: 'Search stations' },
	'Eigen URL': { en: 'Custom URL' },
	'Eigen stream-URL toevoegen': { en: 'Add custom stream URL' },
	'Hernoemen': { en: 'Rename', de: 'Umbenennen', fr: 'Renommer', es: 'Renombrar' },
	'Naam wijzigen': { en: 'Change name' },
	'Naam aanpassen': { en: 'Edit name' },
	'Verslepen om te herordenen': { en: 'Drag to reorder' },
	'Sleep om volgorde te wijzigen': { en: 'Drag to change order' },
	'Stream-URL': { en: 'Stream URL' },
	'Nog geen zones. Voeg er hieronder een toe.': { en: 'No zones yet. Add one below.' },
	'+ Zone toevoegen…': { en: '+ Add zone…' },
	'Verwijderen uit favorieten': { en: 'Remove from favorites' },
	'Aan favorieten toevoegen': { en: 'Add to favorites' },
	'Nog geen favorieten. Klik op het zoek-icon hierboven om stations te zoeken via TuneIn, of op het link-icon om je eigen stream-URL toe te voegen.': {
		en: 'No favorites yet. Click the search icon above to search stations via TuneIn, or the link icon to add your own stream URL.'
	},
	'Spotify gaf "te veel verzoeken" terug. Novapanel pauzeert nu een minuut en probeert daarna automatisch opnieuw.': {
		en: 'Spotify returned "too many requests". Novapanel is pausing for one minute and will retry automatically.'
	},
	'Geen actief Spotify-apparaat. Kies eerst een apparaat in de "Spotify-apparaat"-lijst hierboven, of zet je Onkyo aan en schakel naar de Spotify-bron — dan verschijnt hij in de lijst.': {
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
	'Domeinen': { en: 'Domains', de: 'Domänen', fr: 'Domaines', es: 'Dominios' },
	'komma-gescheiden': { en: 'comma-separated' },
	'Icoon': { en: 'Icon', de: 'Symbol', fr: 'Icône', es: 'Icono' },
	'MDI naam, bv. lightbulb': { en: 'MDI name, e.g. lightbulb' },
	'Optioneel. Beperk tot specifieke device classes (door, window, garage…).': {
		en: 'Optional. Limit to specific device classes (door, window, garage…).'
	},
	'Classes': { en: 'Classes', de: 'Klassen', fr: 'Classes', es: 'Clases' },
	'Welke deuren en ramen zijn open': { en: 'Which doors and windows are open' },
	'Welke apparaten staan aan': { en: 'Which devices are on' },
	'Welke apparaten zijn bereikbaar': { en: 'Which devices are reachable' },
	'Welke spelers worden gevolgd': { en: 'Which players are tracked' },
	'Welke lampen zijn aan': { en: 'Which lights are on' },
	'Openingen': { en: 'Openings', de: 'Öffnungen', fr: 'Ouvertures', es: 'Aperturas' },
	'Beschikbaarheid': { en: 'Availability', de: 'Verfügbarkeit', fr: 'Disponibilité', es: 'Disponibilidad' },
	'Bereikbaarheid en batterijen': { en: 'Reachability and batteries' },
	'Spelers en queue': { en: 'Players and queue' },
	'Stijl en weergave van de klok': { en: 'Clock style and display' },
	'Datumweergave instellen': { en: 'Configure date display' },
	'Koppel aan een weer-entiteit': { en: 'Link a weather entity' },
	'Voorspelling weergeven': { en: 'Show forecast' },
	'Tonen': { en: 'Show', de: 'Anzeigen', fr: 'Afficher', es: 'Mostrar' },
	'Verbergen': { en: 'Hide', de: 'Ausblenden', fr: 'Masquer', es: 'Ocultar' },
	'leeg': { en: 'empty', de: 'leer', fr: 'vide', es: 'vacío' },
	'ingevuld': { en: 'filled', de: 'ausgefüllt', fr: 'rempli', es: 'completado' },
	'vereist': { en: 'required', de: 'erforderlich', fr: 'requis', es: 'obligatorio' },
	'geen apparaten': { en: 'no devices' },
	'apparaat': { en: 'device', de: 'Gerät', fr: 'appareil', es: 'dispositivo' },
	'apparaten': { en: 'devices', de: 'Geräte', fr: 'appareils', es: 'dispositivos' },
	'geen kWh': { en: 'no kWh' },
	'kWh-teller': { en: 'kWh meter' },
	'kWh-tellers': { en: 'kWh meters' },
	'standaard': { en: 'default', de: 'Standard', fr: 'par défaut', es: 'predeterminado' },
	'Standaard': { en: 'Default', de: 'Standard', fr: 'Par défaut', es: 'Predeterminado' },
	'volledig aangepast': { en: 'fully customized' },
	"foto's": { en: 'photos', de: 'Fotos', fr: 'photos', es: 'fotos' },
	'ankers': { en: 'anchors' },
	'Live vermogen': { en: 'Live power' },
	'Real-time vermogen in W. Positief = afname uit het net, negatief = teruglevering.': {
		en: 'Real-time power in W. Positive = grid import, negative = export.'
	},
	'Netto verbruik': { en: 'Net consumption' },
	'Zonnepanelen': { en: 'Solar panels' },
	'Huisverbruik': { en: 'Home consumption' },
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
	'Laadvermogen': { en: 'Charging power' },
	'Live vermogen per apparaat': { en: 'Live power per device' },
	'Selecteer de apparaten waarvan je het live vermogen wilt zien in de afname-sub-pop-up. Toont alleen entiteiten met W/kW als eenheid of': {
		en: 'Select the devices whose live power should appear in the import sub-popup. Only shows entities with W/kW as unit or'
	},
	'kWh vandaag per apparaat': { en: 'kWh today per device' },
	'Optioneel. Selecteer de bijbehorende kWh-tellers per apparaat (zelfde apparaat als hierboven). Toont alleen entiteiten met kWh/Wh als eenheid of': {
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
	'Reset': { en: 'Reset', de: 'Zurücksetzen', fr: 'Réinitialiser', es: 'Restablecer' },
	'Ankers ✓': { en: 'Anchors ✓' },
	'Ankers…': { en: 'Anchors…' },
	'Sectie hernoemen': { en: 'Rename section' },
	'Sectie zonder titel': { en: 'Untitled section' },
	'Sectienaam': { en: 'Section name' },
	'Ma': { en: 'Mo', de: 'Mo', fr: 'Lu', es: 'Lu' },
	'Alarmpaneel': { en: 'Alarm panel' },
	'aan': { en: 'on', de: 'ein', fr: 'allumé', es: 'encendido' },
	'Leeslamp': { en: 'Reading light' },
	'Thermostaat': { en: 'Thermostat' },
	'Gordijnen': { en: 'Curtains' },
	'open': { en: 'open', de: 'offen', fr: 'ouvert', es: 'abierto' },
	'Woonkamer': { en: 'Living room' },
	'Speelt muziek': { en: 'Playing music' },
	'Ramen/Deuren': { en: 'Windows/Doors' },
	'Apparatenstatus': { en: 'Device status' },
	'Alles bereikbaar': { en: 'Everything reachable' },
	'Thuisaccu': { en: 'Home battery' },
	'Buig flow-lijnen': { en: 'Bend flow lines' },
	'Accu': { en: 'Battery' },
	'Voordeur': { en: 'Front door' },
	'Auto-laadpunt': { en: 'Car charger' },
	'Straat / net': { en: 'Street / grid' },
	'Rail (fallback)': { en: 'Rail (fallback)' },
	'Klik op de foto om een buigpunt toe te voegen, of sleep een bestaand punt. Klik op een buigpunt om te verwijderen.': {
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
	if (!browser) return fallback;
	const saved = localStorage.getItem(STORAGE_KEY);
	return isLanguageCode(saved) ? saved : fallback;
}

export function translate(key: TranslationKey | string, language: LanguageCode = DEFAULT_LANGUAGE): string {
	const selected = isLanguageCode(language) ? language : DEFAULT_LANGUAGE;
	if (selected === 'nl' && phraseTranslations[key]) {
		return phraseTranslations[key]?.nl ?? key;
	}
	return (
		catalogFor(selected)[key] ??
		phraseTranslations[key]?.[selected] ??
		catalogFor(DEFAULT_LANGUAGE)[key] ??
		phraseTranslations[key]?.[DEFAULT_LANGUAGE] ??
		phraseTranslations[key]?.nl ??
		key
	);
}

export function translateState(state: string | undefined, language: LanguageCode = DEFAULT_LANGUAGE): string {
	const normalized = (state ?? '').toLowerCase();
	const phrase = stateTranslations[normalized] ?? (state || 'Onbekend');
	return translate(phrase, language);
}
