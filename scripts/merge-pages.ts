import * as fs from 'fs';
import { program } from 'commander';

interface ChapterMetadata {
  lesson: string;
  title: string;
  subtitle: string;
  pageRange: string;
  source: string;
  totalPages: number;
  learningObjectives: string[];
  prerequisiteLessons?: string[];
}

interface ChapterExtraction {
  chapterMetadata: ChapterMetadata;
  translationPairs: Record<string, any[]>;
  grammarRules: any[];
  exercises: any[];
  culturalNotes: any[];
  dialogues?: any[];
  visualAids?: any[];
}

program
  .requiredOption('-o, --output <file>', 'Output JSON file')
  .argument('<files...>', 'Page-level JSON files to merge')
  .parse();

const opts = program.opts();
const files: string[] = program.args as string[];

const merged: ChapterExtraction = {
  chapterMetadata: {} as any,
  translationPairs: {},
  grammarRules: [],
  exercises: [],
  culturalNotes: [],
  dialogues: [],
  visualAids: []
};

for (const file of files) {
  const content = fs.readFileSync(file, 'utf-8');
  const data: ChapterExtraction = JSON.parse(content);

  if (!merged.chapterMetadata.lesson) {
    merged.chapterMetadata = data.chapterMetadata;
  }

  for (const [cat, items] of Object.entries(data.translationPairs)) {
    if (!merged.translationPairs[cat]) merged.translationPairs[cat] = [];
    merged.translationPairs[cat].push(...items);
  }

  merged.grammarRules.push(...(data.grammarRules || []));
  merged.exercises.push(...(data.exercises || []));
  merged.culturalNotes.push(...(data.culturalNotes || []));
  if (data.dialogues) merged.dialogues!.push(...data.dialogues);
  if (data.visualAids) merged.visualAids!.push(...data.visualAids);
}

fs.writeFileSync(opts.output, JSON.stringify(merged, null, 2));
console.log(`Merged ${files.length} files into ${opts.output}`);
