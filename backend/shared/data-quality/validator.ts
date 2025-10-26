/**
 * Data Quality Validator
 * 
 * Implements data quality checks based on the schema contract
 * and medallion architecture quality rules.
 */

export interface QualityCheck {
  rule: string;
  severity: 'error' | 'warning' | 'info';
  field?: string;
  condition: (data: any) => boolean;
  message: string;
}

export interface QualityCheckResult {
  passed: boolean;
  rule: string;
  severity: 'error' | 'warning' | 'info';
  field?: string;
  message: string;
  failedRecords?: number;
}

export interface QualityReport {
  totalRecords: number;
  checksRun: number;
  checksPassed: number;
  checksFailed: number;
  errors: QualityCheckResult[];
  warnings: QualityCheckResult[];
  infos: QualityCheckResult[];
  overallStatus: 'pass' | 'fail' | 'warn';
}

/**
 * Dictionary entry quality checks based on schema contract
 */
export const DICTIONARY_QUALITY_CHECKS: QualityCheck[] = [
  {
    rule: 'required_fijian_word',
    severity: 'error',
    field: 'fijian_word',
    condition: (entry) => Boolean(entry.fijian_word && entry.fijian_word.trim().length > 0),
    message: 'Fijian word is required and must not be empty',
  },
  {
    rule: 'required_english_translation',
    severity: 'error',
    field: 'english_translation',
    condition: (entry) => Boolean(entry.english_translation && entry.english_translation.trim().length > 0),
    message: 'English translation is required and must not be empty',
  },
  {
    rule: 'valid_part_of_speech',
    severity: 'warning',
    field: 'part_of_speech',
    condition: (entry) => {
      if (!entry.part_of_speech) return true; // Optional field
      const validValues = ['noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition', 'conjunction', 'interjection', 'phrase'];
      return validValues.includes(entry.part_of_speech.toLowerCase());
    },
    message: 'Part of speech must be from valid enum list',
  },
  {
    rule: 'valid_difficulty_level',
    severity: 'warning',
    field: 'difficulty_level',
    condition: (entry) => {
      if (!entry.difficulty_level) return true; // Optional field
      const validValues = ['beginner', 'intermediate', 'advanced'];
      return validValues.includes(entry.difficulty_level.toLowerCase());
    },
    message: 'Difficulty level must be beginner, intermediate, or advanced',
  },
  {
    rule: 'fijian_word_length',
    severity: 'error',
    field: 'fijian_word',
    condition: (entry) => {
      const word = entry.fijian_word || '';
      return word.length >= 1 && word.length <= 200;
    },
    message: 'Fijian word length must be between 1 and 200 characters',
  },
  {
    rule: 'english_translation_length',
    severity: 'error',
    field: 'english_translation',
    condition: (entry) => {
      const translation = entry.english_translation || '';
      return translation.length >= 1 && translation.length <= 500;
    },
    message: 'English translation length must be between 1 and 500 characters',
  },
  {
    rule: 'usage_examples_structure',
    severity: 'warning',
    field: 'usage_examples',
    condition: (entry) => {
      if (!entry.usage_examples) return true; // Optional field
      if (!Array.isArray(entry.usage_examples)) return false;
      return entry.usage_examples.every(
        (ex: any) => ex && typeof ex === 'object' && ex.fijian && ex.english
      );
    },
    message: 'Usage examples must be array of objects with fijian and english fields',
  },
  {
    rule: 'verified_entries_have_examples',
    severity: 'warning',
    field: 'usage_examples',
    condition: (entry) => {
      if (!entry.verified) return true; // Only check verified entries
      return Array.isArray(entry.usage_examples) && entry.usage_examples.length > 0;
    },
    message: 'Verified entries should have at least one usage example',
  },
  {
    rule: 'frequency_rank_valid',
    severity: 'warning',
    field: 'frequency_rank',
    condition: (entry) => {
      if (!entry.frequency_rank) return true; // Optional field
      const rank = parseInt(entry.frequency_rank);
      return !isNaN(rank) && rank > 0;
    },
    message: 'Frequency rank must be a positive integer',
  },
  {
    rule: 'timestamps_valid',
    severity: 'error',
    field: 'updated_at',
    condition: (entry) => {
      if (!entry.updated_at) return false;
      const date = new Date(entry.updated_at);
      return !isNaN(date.getTime());
    },
    message: 'Updated timestamp must be a valid ISO 8601 date',
  },
];

/**
 * Run quality checks on a dataset
 */
export function runQualityChecks(
  data: any[],
  checks: QualityCheck[] = DICTIONARY_QUALITY_CHECKS
): QualityReport {
  const report: QualityReport = {
    totalRecords: data.length,
    checksRun: 0,
    checksPassed: 0,
    checksFailed: 0,
    errors: [],
    warnings: [],
    infos: [],
    overallStatus: 'pass',
  };

  for (const check of checks) {
    report.checksRun++;
    
    let failedRecords = 0;
    for (const record of data) {
      if (!check.condition(record)) {
        failedRecords++;
      }
    }

    const checkResult: QualityCheckResult = {
      passed: failedRecords === 0,
      rule: check.rule,
      severity: check.severity,
      field: check.field,
      message: check.message,
      failedRecords,
    };

    if (failedRecords === 0) {
      report.checksPassed++;
    } else {
      report.checksFailed++;

      switch (check.severity) {
        case 'error':
          report.errors.push(checkResult);
          report.overallStatus = 'fail';
          break;
        case 'warning':
          report.warnings.push(checkResult);
          if (report.overallStatus === 'pass') {
            report.overallStatus = 'warn';
          }
          break;
        case 'info':
          report.infos.push(checkResult);
          break;
      }
    }
  }

  return report;
}

/**
 * Calculate data quality metrics
 */
export interface DataQualityMetrics {
  recordCount: number;
  nullRates: Record<string, number>;
  duplicateRate: number;
  schemaConformity: number;
  averageFieldPopulation: number;
}

export function calculateMetrics(data: any[], schema: string[]): DataQualityMetrics {
  const recordCount = data.length;
  
  // Calculate null rates per field
  const nullRates: Record<string, number> = {};
  for (const field of schema) {
    const nullCount = data.filter(record => !record[field] || record[field] === null).length;
    nullRates[field] = recordCount > 0 ? nullCount / recordCount : 0;
  }

  // Calculate duplicate rate
  const seen = new Set<string>();
  let duplicates = 0;
  for (const record of data) {
    const key = JSON.stringify([record.fijian_word, record.english_translation]);
    if (seen.has(key)) {
      duplicates++;
    }
    seen.add(key);
  }
  const duplicateRate = recordCount > 0 ? duplicates / recordCount : 0;

  // Schema conformity (all required fields present)
  const requiredFields = ['fijian_word', 'english_translation'];
  const conformingRecords = data.filter(record =>
    requiredFields.every(field => record[field] !== undefined && record[field] !== null)
  ).length;
  const schemaConformity = recordCount > 0 ? conformingRecords / recordCount : 0;

  // Average field population
  const totalFields = schema.length;
  const totalPopulated = data.reduce((sum, record) => {
    const populated = schema.filter(field => record[field] !== undefined && record[field] !== null).length;
    return sum + populated;
  }, 0);
  const averageFieldPopulation = (recordCount * totalFields) > 0 ? totalPopulated / (recordCount * totalFields) : 0;

  return {
    recordCount,
    nullRates,
    duplicateRate,
    schemaConformity,
    averageFieldPopulation,
  };
}

/**
 * Validate against schema contract
 */
export function validateSchemaContract(data: any[], schemaVersion: string): boolean {
  // This would load and validate against the YAML schema contract
  // For now, we'll do basic validation
  
  const requiredFields = ['fijian_word', 'english_translation'];
  
  for (const record of data) {
    for (const field of requiredFields) {
      if (!record[field]) {
        console.error(`Schema validation failed: missing required field ${field}`);
        return false;
      }
    }
  }

  return true;
}

/**
 * Generate quality report summary
 */
export function generateReportSummary(report: QualityReport): string {
  const lines: string[] = [];
  
  lines.push('=== Data Quality Report ===');
  lines.push(`Total Records: ${report.totalRecords}`);
  lines.push(`Checks Run: ${report.checksRun}`);
  lines.push(`Checks Passed: ${report.checksPassed}`);
  lines.push(`Checks Failed: ${report.checksFailed}`);
  lines.push(`Overall Status: ${report.overallStatus.toUpperCase()}`);
  lines.push('');

  if (report.errors.length > 0) {
    lines.push('ERRORS:');
    for (const error of report.errors) {
      lines.push(`  - ${error.rule}: ${error.message} (${error.failedRecords} records)`);
    }
    lines.push('');
  }

  if (report.warnings.length > 0) {
    lines.push('WARNINGS:');
    for (const warning of report.warnings) {
      lines.push(`  - ${warning.rule}: ${warning.message} (${warning.failedRecords} records)`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
