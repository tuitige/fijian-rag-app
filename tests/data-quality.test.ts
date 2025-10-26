/**
 * Tests for Data Quality Validator
 */
import {
  runQualityChecks,
  calculateMetrics,
  validateSchemaContract,
  generateReportSummary,
  DICTIONARY_QUALITY_CHECKS
} from '../backend/shared/data-quality/validator';

describe('Data Quality Validator', () => {
  describe('runQualityChecks', () => {
    it('should pass all checks for valid dictionary entries', () => {
      const validEntries = [
        {
          fijian_word: 'bula',
          english_translation: 'hello',
          part_of_speech: 'noun',
          difficulty_level: 'beginner',
          verified: true,
          updated_at: new Date().toISOString(),
          usage_examples: [
            { fijian: 'Ni sa bula', english: 'Hello' }
          ]
        },
        {
          fijian_word: 'vinaka',
          english_translation: 'thank you',
          part_of_speech: 'verb',
          difficulty_level: 'beginner',
          verified: true,
          updated_at: new Date().toISOString(),
          usage_examples: [
            { fijian: 'Vinaka vaka levu', english: 'Thank you very much' }
          ]
        }
      ];

      const report = runQualityChecks(validEntries, DICTIONARY_QUALITY_CHECKS);

      expect(report.overallStatus).toBe('pass');
      expect(report.errors.length).toBe(0);
      expect(report.checksPassed).toBeGreaterThan(0);
    });

    it('should fail when required fields are missing', () => {
      const invalidEntries = [
        {
          fijian_word: '',
          english_translation: 'hello'
        },
        {
          fijian_word: 'vinaka',
          english_translation: ''
        }
      ];

      const report = runQualityChecks(invalidEntries as any, DICTIONARY_QUALITY_CHECKS);

      expect(report.overallStatus).toBe('fail');
      expect(report.errors.length).toBeGreaterThan(0);
      expect(report.errors.some(e => e.rule === 'required_fijian_word')).toBe(true);
    });

    it('should warn on invalid part_of_speech values', () => {
      const entriesWithInvalidPOS = [
        {
          fijian_word: 'bula',
          english_translation: 'hello',
          part_of_speech: 'invalid_pos',
          verified: false,
          updated_at: new Date().toISOString()
        }
      ];

      const report = runQualityChecks(entriesWithInvalidPOS, DICTIONARY_QUALITY_CHECKS);

      expect(report.overallStatus).toBe('warn');
      expect(report.warnings.length).toBeGreaterThan(0);
      expect(report.warnings.some(w => w.rule === 'valid_part_of_speech')).toBe(true);
    });

    it('should warn when verified entries lack usage examples', () => {
      const entriesWithoutExamples = [
        {
          fijian_word: 'bula',
          english_translation: 'hello',
          verified: true,
          updated_at: new Date().toISOString(),
          usage_examples: []
        }
      ];

      const report = runQualityChecks(entriesWithoutExamples, DICTIONARY_QUALITY_CHECKS);

      expect(report.overallStatus).toBe('warn');
      expect(report.warnings.some(w => w.rule === 'verified_entries_have_examples')).toBe(true);
    });

    it('should validate word length constraints', () => {
      const entriesWithInvalidLength = [
        {
          fijian_word: '',
          english_translation: 'hello',
          verified: false,
          updated_at: new Date().toISOString()
        },
        {
          fijian_word: 'a'.repeat(201),
          english_translation: 'hello',
          verified: false,
          updated_at: new Date().toISOString()
        }
      ];

      const report = runQualityChecks(entriesWithInvalidLength, DICTIONARY_QUALITY_CHECKS);

      expect(report.errors.some(e => e.rule === 'fijian_word_length')).toBe(true);
    });
  });

  describe('calculateMetrics', () => {
    it('should calculate correct null rates', () => {
      const entries = [
        {
          fijian_word: 'bula',
          english_translation: 'hello',
          pronunciation: 'mbula',
          part_of_speech: null,
          verified: true
        },
        {
          fijian_word: 'vinaka',
          english_translation: 'thank you',
          pronunciation: null,
          part_of_speech: 'noun',
          verified: true
        }
      ];

      const schema = ['fijian_word', 'english_translation', 'pronunciation', 'part_of_speech', 'verified'];
      const metrics = calculateMetrics(entries, schema);

      expect(metrics.recordCount).toBe(2);
      expect(metrics.nullRates.fijian_word).toBe(0);
      expect(metrics.nullRates.english_translation).toBe(0);
      expect(metrics.nullRates.pronunciation).toBe(0.5);
      expect(metrics.nullRates.part_of_speech).toBe(0.5);
    });

    it('should calculate duplicate rate correctly', () => {
      const entries = [
        {
          fijian_word: 'bula',
          english_translation: 'hello'
        },
        {
          fijian_word: 'bula',
          english_translation: 'hello'
        },
        {
          fijian_word: 'vinaka',
          english_translation: 'thank you'
        }
      ];

      const schema = ['fijian_word', 'english_translation'];
      const metrics = calculateMetrics(entries, schema);

      expect(metrics.duplicateRate).toBeCloseTo(0.333, 2);
    });

    it('should calculate schema conformity', () => {
      const entries = [
        {
          fijian_word: 'bula',
          english_translation: 'hello'
        },
        {
          fijian_word: null,
          english_translation: 'thank you'
        },
        {
          fijian_word: 'moce',
          english_translation: null
        }
      ];

      const schema = ['fijian_word', 'english_translation'];
      const metrics = calculateMetrics(entries, schema);

      expect(metrics.schemaConformity).toBeCloseTo(0.333, 2);
    });

    it('should calculate average field population', () => {
      const entries = [
        {
          fijian_word: 'bula',
          english_translation: 'hello',
          pronunciation: 'mbula'
        },
        {
          fijian_word: 'vinaka',
          english_translation: null,
          pronunciation: null
        }
      ];

      const schema = ['fijian_word', 'english_translation', 'pronunciation'];
      const metrics = calculateMetrics(entries, schema);

      expect(metrics.averageFieldPopulation).toBeCloseTo(0.666, 2);
    });
  });

  describe('validateSchemaContract', () => {
    it('should validate entries that meet schema contract', () => {
      const validEntries = [
        {
          fijian_word: 'bula',
          english_translation: 'hello'
        },
        {
          fijian_word: 'vinaka',
          english_translation: 'thank you'
        }
      ];

      const isValid = validateSchemaContract(validEntries, '1.0');

      expect(isValid).toBe(true);
    });

    it('should reject entries missing required fields', () => {
      const invalidEntries = [
        {
          fijian_word: 'bula'
          // missing english_translation
        }
      ];

      const isValid = validateSchemaContract(invalidEntries, '1.0');

      expect(isValid).toBe(false);
    });
  });

  describe('generateReportSummary', () => {
    it('should generate readable summary for passing report', () => {
      const report = {
        totalRecords: 10,
        checksRun: 8,
        checksPassed: 8,
        checksFailed: 0,
        errors: [],
        warnings: [],
        infos: [],
        overallStatus: 'pass' as const
      };

      const summary = generateReportSummary(report);

      expect(summary).toContain('Total Records: 10');
      expect(summary).toContain('Checks Passed: 8');
      expect(summary).toContain('PASS');
    });

    it('should generate summary with errors listed', () => {
      const report = {
        totalRecords: 10,
        checksRun: 8,
        checksPassed: 6,
        checksFailed: 2,
        errors: [
          {
            passed: false,
            rule: 'required_fijian_word',
            severity: 'error' as const,
            message: 'Fijian word is required',
            failedRecords: 2
          }
        ],
        warnings: [],
        infos: [],
        overallStatus: 'fail' as const
      };

      const summary = generateReportSummary(report);

      expect(summary).toContain('ERRORS:');
      expect(summary).toContain('required_fijian_word');
      expect(summary).toContain('2 records');
      expect(summary).toContain('FAIL');
    });

    it('should generate summary with warnings listed', () => {
      const report = {
        totalRecords: 10,
        checksRun: 8,
        checksPassed: 7,
        checksFailed: 1,
        errors: [],
        warnings: [
          {
            passed: false,
            rule: 'valid_part_of_speech',
            severity: 'warning' as const,
            message: 'Invalid part of speech',
            failedRecords: 3
          }
        ],
        infos: [],
        overallStatus: 'warn' as const
      };

      const summary = generateReportSummary(report);

      expect(summary).toContain('WARNINGS:');
      expect(summary).toContain('valid_part_of_speech');
      expect(summary).toContain('3 records');
      expect(summary).toContain('WARN');
    });
  });
});
