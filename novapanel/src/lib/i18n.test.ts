import { describe, expect, it } from 'vitest';
import { getNativePhraseTranslationGaps } from './i18n';

describe('i18n phrase translations', () => {
	it('keeps native German, French, and Spanish coverage for English phrase fallbacks', () => {
		expect(getNativePhraseTranslationGaps()).toEqual([]);
	});
});
