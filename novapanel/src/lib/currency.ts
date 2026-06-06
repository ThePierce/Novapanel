export const DEFAULT_CURRENCY_CODE = 'EUR';

export const currencyOptions = [
	{ code: 'EUR', label: 'EUR - Euro' },
	{ code: 'USD', label: 'USD - US dollar' },
	{ code: 'GBP', label: 'GBP - Pound sterling' },
	{ code: 'CHF', label: 'CHF - Swiss franc' },
	{ code: 'CAD', label: 'CAD - Canadian dollar' },
	{ code: 'AUD', label: 'AUD - Australian dollar' },
	{ code: 'SEK', label: 'SEK - Swedish krona' },
	{ code: 'NOK', label: 'NOK - Norwegian krone' },
	{ code: 'DKK', label: 'DKK - Danish krone' },
	{ code: 'PLN', label: 'PLN - Polish zloty' },
	{ code: 'CZK', label: 'CZK - Czech koruna' }
] as const;

export function coerceCurrencyCode(value: unknown, fallback = DEFAULT_CURRENCY_CODE): string {
	if (typeof value !== 'string') return fallback;
	const normalized = value.trim().toUpperCase();
	return /^[A-Z]{3}$/.test(normalized) ? normalized : fallback;
}

export function formatCurrency(value: number, locale: string, currencyCode: unknown): string {
	const normalized = coerceCurrencyCode(currencyCode);
	try {
		return new Intl.NumberFormat(locale, {
			style: 'currency',
			currency: normalized
		}).format(value);
	} catch {
		return new Intl.NumberFormat(locale, {
			style: 'currency',
			currency: DEFAULT_CURRENCY_CODE
		}).format(value);
	}
}
