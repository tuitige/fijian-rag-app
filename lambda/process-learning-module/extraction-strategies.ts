// lambda/process-learning-module/extraction-strategies.ts

import { Anthropic } from '@anthropic-ai/sdk';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import {
  ChapterManifest,
  ChapterExtraction,
  TranslationItem,
  GrammarRule,
  Exercise,
  CulturalNote,
  Dialogue,
  VisualAid
} from './interfaces';

const s3 = new S3Client({});

interface ExtractionStrategy {
  name: string;
  model: string;
  batchSize: number;
  contextStrategy: 'full' | 'progressive' | 'summary';
}

interface ExtractionResult {
  strategy: ExtractionStrategy;
  extraction: ChapterExtraction;
  stats: ExtractionStats;
  performance: {
    totalTime: number;
    tokensUsed: number;
    costEstimate: number;
  };
}

interface ExtractionStats {
  totalTranslations: number;
  categoryCounts: Record<string, number>;
  pagesWithContent: number[];
  missingPages: number[];
  avgItemsPerPage: number;
  grammarRules: number;
  exercises: number;
}

// Main comparison function
export async function compareExtractionStrategies(
  anthropic: Anthropic,
  images: { page: number; base64: string; filename: string }[],
  manifest: ChapterManifest
): Promise<ExtractionResult[]> {
  console.log('🔬 Starting extraction strategy comparison...');
  
  const strategies: ExtractionStrategy[] = [
    // Full chapter processing
    { name: 'Opus-4-Full', model: 'claude-3-opus-20240229', batchSize: images.length, contextStrategy: 'full' },
    { name: 'Sonnet-4-Full', model: 'claude-3-5-sonnet-20241022', batchSize: images.length, contextStrategy: 'full' },
    
    // Batch processing with context
    { name: 'Opus-4-Batch-Context', model: 'claude-3-opus-20240229', batchSize: 3, contextStrategy: 'progressive' },
    { name: 'Sonnet-4-Batch-Context', model: 'claude-3-5-sonnet-20241022', batchSize: 3, contextStrategy: 'progressive' },
    
    // Hybrid: Overview + Details
    { name: 'Sonnet-4-Hybrid', model: 'claude-3-5-sonnet-20241022', batchSize: 3, contextStrategy: 'summary' }
  ];
  
  const results: ExtractionResult[] = [];
  
  for (const strategy of strategies) {
    console.log(`\n📋 Testing strategy: ${strategy.name}`);
    const startTime = Date.now();
    
    try {
      let extraction: ChapterExtraction;
      let totalTokens = 0;
      
      if (strategy.contextStrategy === 'full') {
        // Process all pages at once
        const result = await extractWithFullContext(anthropic, images, manifest, strategy.model);
        extraction = result.extraction;
        totalTokens = result.tokensUsed;
        
      } else if (strategy.contextStrategy === 'progressive') {
        // Batch with progressive context
        const result = await extractWithProgressiveContext(anthropic, images, manifest, strategy);
        extraction = result.extraction;
        totalTokens = result.tokensUsed;
        
      } else if (strategy.contextStrategy === 'summary') {
        // Hybrid approach: overview then details
        const result = await extractWithHybridApproach(anthropic, images, manifest, strategy);
        extraction = result.extraction;
        totalTokens = result.tokensUsed;
      } else {
        throw new Error(`Unknown contextStrategy: ${strategy.contextStrategy}`);
      }
      
      if (!extraction) {
        throw new Error('Extraction was not assigned.');
      }
      const stats = calculateExtractionStats(extraction);
      const totalTime = Date.now() - startTime;
      
      const result: ExtractionResult = {
        strategy,
        extraction,
        stats,
        performance: {
          totalTime,
          tokensUsed: totalTokens,
          costEstimate: estimateCost(strategy.model, totalTokens)
        }
      };
      
      results.push(result);
      
      // Log summary
      console.log(`✅ ${strategy.name} completed:`);
      console.log(`   - Items extracted: ${stats.totalTranslations}`);
      console.log(`   - Pages with content: ${stats.pagesWithContent.length}/${images.length}`);
      console.log(`   - Time: ${(totalTime / 1000).toFixed(1)}s`);
      console.log(`   - Tokens: ${totalTokens.toLocaleString()}`);
      
    } catch (error) {
      console.error(`❌ ${strategy.name} failed:`, error);
    }
  }
  
  // Save comparison report
  await saveComparisonReport(results, manifest);
  
  return results;
}

// Strategy 1: Full context (existing approach)
async function extractWithFullContext(
  anthropic: Anthropic,
  images: { page: number; base64: string; filename: string }[],
  manifest: ChapterManifest,
  model: string
): Promise<{ extraction: ChapterExtraction; tokensUsed: number }> {
  
  const systemPrompt = createSystemPrompt();
  const userPrompt = createUserPrompt(manifest, images.length);
  
  const imageMessages = images.map(img => ({
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: 'image/jpeg' as const,
      data: img.base64
    }
  }));
  
  const message = await anthropic.messages.create({
    model,
    max_tokens: 8000,
    temperature: 0.1,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: userPrompt },
        ...imageMessages
      ]
    }]
  });
  
  const extraction = parseClaudeResponse(message);
  return {
    extraction,
    tokensUsed: message.usage.input_tokens + message.usage.output_tokens
  };
}

// Strategy 2: Progressive context batching
export async function extractWithProgressiveContext(
  anthropic: Anthropic,
  images: { page: number; base64: string; filename: string }[],
  manifest: ChapterManifest,
  strategy: ExtractionStrategy
): Promise<{ extraction: ChapterExtraction; tokensUsed: number }> {
  
  const batchSize = strategy.batchSize;
  const systemPrompt = createSystemPrompt();
  
  let cumulativeContext = {
    chapterTitle: '',
    learningObjectives: [] as string[],
    vocabularySoFar: {} as Record<string, string[]>,
    grammarPatterns: [] as string[]
  };
  
  const batchExtractions: ChapterExtraction[] = [];
  let totalTokens = 0;
  
  for (let i = 0; i < images.length; i += batchSize) {
    const batch = images.slice(i, i + batchSize);
    const isFirstBatch = i === 0;
    const isLastBatch = i + batchSize >= images.length;
    
    console.log(`  Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(images.length/batchSize)}`);
    
    // Build context-aware prompt
    const batchPrompt = `
    IMPORTANT:
- Respond ONLY with valid minified JSON.
- DO NOT include any explanation, markdown, or code fences.
- DO NOT say anything before or after the JSON.
- If you cannot answer, respond with: {}

Here is an example of the expected JSON structure:
{"chapterMetadata":{"lesson":"..."},"translationPairs":{},"grammarRules":[],"exercises":[],"culturalNotes":[]}

${isFirstBatch ? 'This is the FIRST batch of pages from ' : 'This is a CONTINUATION of'} Chapter ${manifest.chapter}: ${manifest.topic}

${!isFirstBatch ? `Context from previous pages:
- Chapter Title: ${cumulativeContext.chapterTitle}
- Learning Objectives: ${cumulativeContext.learningObjectives.join(', ')}
- Vocabulary categories found so far: ${Object.keys(cumulativeContext.vocabularySoFar).join(', ')}
- Grammar patterns identified: ${cumulativeContext.grammarPatterns.join(', ')}

Please continue extracting from where we left off. Make sure to:
1. Use consistent category names with what's been found
2. Note any references to previous pages
3. Continue numbering exercises/dialogues sequentially` : 
'Please extract everything from these pages, paying special attention to the chapter title and learning objectives.'}

Pages in this batch: ${batch.map(b => b.page).join(', ')}
Total chapter pages: ${manifest.totalPages}
`;
    
    const imageMessages = batch.map(img => ({
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: 'image/jpeg' as const,
        data: img.base64
      }
    }));
    
    const message = await anthropic.messages.create({
      model: strategy.model,
      max_tokens: 4000,
      temperature: 0.1,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: batchPrompt },
          ...imageMessages
        ]
      }]
    });
    
    const batchExtraction = parseClaudeResponse(message);
    console.log('Batch extraction:', JSON.stringify(batchExtraction, null, 2));

    batchExtractions.push(batchExtraction);
    totalTokens += message.usage.input_tokens + message.usage.output_tokens;
    
    // Update cumulative context
    if (isFirstBatch && batchExtraction.chapterMetadata) {
      cumulativeContext.chapterTitle = batchExtraction.chapterMetadata.title || '';
      cumulativeContext.learningObjectives = batchExtraction.chapterMetadata.learningObjectives || [];
    }
    
    // Track vocabulary categories
    for (const [category, items] of Object.entries(batchExtraction.translationPairs || {})) {
      if (!cumulativeContext.vocabularySoFar[category]) {
        cumulativeContext.vocabularySoFar[category] = [];
      }
      if (Array.isArray(items)) {
        cumulativeContext.vocabularySoFar[category].push(
          ...items.slice(0, 3).map(i => i.fijian)
        );
      }
    }
    
    // Track grammar patterns
    if (batchExtraction.grammarRules) {
      cumulativeContext.grammarPatterns.push(
        ...batchExtraction.grammarRules.map(r => r.concept).slice(0, 2)
      );
    }
  }
  
  // Merge all batch extractions intelligently
  const merged = mergeExtractionsWithContext(batchExtractions, manifest);
  
  return { extraction: merged, tokensUsed: totalTokens };
}

// Strategy 3: Hybrid approach - overview then details
async function extractWithHybridApproach(
  anthropic: Anthropic,
  images: { page: number; base64: string; filename: string }[],
  manifest: ChapterManifest,
  strategy: ExtractionStrategy
): Promise<{ extraction: ChapterExtraction; tokensUsed: number }> {
  
  console.log('  Phase 1: Getting chapter overview...');
  
  // Phase 1: Get overview with sample pages (first, middle, last)
  const overviewPages = [
    images[0],
    images[Math.floor(images.length / 2)],
    images[images.length - 1]
  ];
  
  const overviewPrompt = `
Analyze these sample pages from Chapter ${manifest.chapter} to understand the overall structure.
Pages shown: ${overviewPages.map(p => p.page).join(', ')} (out of ${images.length} total)

Please identify:
1. Chapter title and learning objectives
2. Main vocabulary categories/themes
3. Grammar concepts covered
4. Types of exercises present
5. Overall teaching approach

This overview will guide detailed extraction of all pages.
`;
  
  const overviewMessage = await anthropic.messages.create({
    model: strategy.model,
    max_tokens: 2000,
    temperature: 0.1,
    system: createSystemPrompt(),
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: overviewPrompt },
        ...overviewPages.map(img => ({
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: 'image/jpeg' as const,
            data: img.base64
          }
        }))
      ]
    }]
  });
  
  const overview = parseClaudeResponse(overviewMessage);
  let totalTokens = overviewMessage.usage.input_tokens + overviewMessage.usage.output_tokens;
  
  console.log('  Phase 2: Detailed extraction with context...');
  
  // Phase 2: Process all pages in batches with overview context
  const batchExtractions: ChapterExtraction[] = [];
  const batchSize = strategy.batchSize;
  
  for (let i = 0; i < images.length; i += batchSize) {
    const batch = images.slice(i, i + batchSize);
    
    const detailPrompt = `
Based on the chapter overview:
- Title: ${overview.chapterMetadata?.title || manifest.topic}
- Categories: ${Object.keys(overview.translationPairs || {}).join(', ')}
- Grammar focus: ${overview.grammarRules?.map(r => r.concept).join(', ') || 'various'}

Now extract ALL content from pages ${batch.map(b => b.page).join(', ')}.
Be thorough - extract every translation pair, example, and exercise.
Use the same category names as identified in the overview.
`;
    
const detailMessage = await anthropic.messages.create({
  model: strategy.model,
  max_tokens: 4000,
  temperature: 0.1,
  system: createSystemPrompt(),
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: detailPrompt },
      ...batch.map(img => ({
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: 'image/jpeg' as const,
          data: img.base64
        }
      }))
    ]
  }]
});
    
    batchExtractions.push(parseClaudeResponse(detailMessage));
    totalTokens += detailMessage.usage.input_tokens + detailMessage.usage.output_tokens;
  }
  
  // Merge with overview as the base
  const merged = mergeExtractionsWithContext([overview, ...batchExtractions], manifest);
  
  return { extraction: merged, tokensUsed: totalTokens };
}

// Helper: Create consistent system prompt
function createSystemPrompt(): string {
  return `You are analyzing pages from a Fijian language learning manual (Peace Corps).

CRITICAL INSTRUCTIONS:
1. Extract EVERY SINGLE Fijian word, phrase, or sentence that has an English translation
2. Look at ALL tables, lists, example sentences, exercises, and dialogues
3. Do NOT skip any content - even if it seems repetitive
4. Check the entire page including margins, footnotes, and captions
5. Maintain consistency in category names across batches

[Rest of the JSON structure instructions...]`;
}

// Helper: Create user prompt
function createUserPrompt(manifest: ChapterManifest, pageCount: number): string {
  return `Chapter: ${manifest.chapter}
Topic: ${manifest.topic}
Total pages: ${pageCount}

Extract ALL content following the JSON structure. Be thorough and complete.`;
}

// Helper: Parse Claude response
function parseClaudeResponse(message: any): ChapterExtraction {
  const responseText = message.content
    .filter((block: any) => block.type === 'text')
    .map((block: any) => block.text)
    .join('\n');
  
  let cleanedResponse = responseText.trim();
  if (cleanedResponse.startsWith('```json')) {
    cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleanedResponse.startsWith('```')) {
    cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  
  return JSON.parse(cleanedResponse);
}

// Helper: Merge extractions intelligently
function mergeExtractionsWithContext(
  extractions: ChapterExtraction[],
  manifest: ChapterManifest
): ChapterExtraction {
  // Use first extraction's metadata as base
  const merged: ChapterExtraction = {
    chapterMetadata: {
      ...extractions[0].chapterMetadata,
      totalPages: manifest.totalPages,
      pageRange: `${manifest.startPage}-${manifest.startPage + manifest.totalPages - 1}`
    },
    translationPairs: {},
    grammarRules: [],
    exercises: [],
    culturalNotes: [],
    dialogues: [],
    visualAids: []
  };
  
  // Category normalization map
  const categoryMap: Record<string, string> = {};
  
  // First pass: identify all category variations
  for (const extraction of extractions) {
    for (const category of Object.keys(extraction.translationPairs || {})) {
      const normalized = category.toLowerCase().replace(/[^a-z]/g, '');
      if (!categoryMap[normalized]) {
        categoryMap[normalized] = category;
      }
    }
  }
  
  // Second pass: merge with normalized categories
  for (const extraction of extractions) {
    for (const [category, items] of Object.entries(extraction.translationPairs || {})) {
      const normalized = category.toLowerCase().replace(/[^a-z]/g, '');
      const canonicalCategory = categoryMap[normalized];
      
      if (!merged.translationPairs[canonicalCategory]) {
        merged.translationPairs[canonicalCategory] = [];
      }
      merged.translationPairs[canonicalCategory].push(...items);
    }
    
    // Merge other content
    merged.grammarRules.push(...(extraction.grammarRules || []));
    merged.exercises.push(...(extraction.exercises || []));
    merged.culturalNotes.push(...(extraction.culturalNotes || []));
    merged.dialogues?.push(...(extraction.dialogues || []));
    merged.visualAids?.push(...(extraction.visualAids || []));
  }
  
  // Deduplicate
  for (const category in merged.translationPairs) {
    merged.translationPairs[category] = deduplicateItems(merged.translationPairs[category]);
  }
  
  return merged;
}

// Helper: Deduplicate items
function deduplicateItems(items: any[]): any[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = `${item.fijian || item.concept || item.id}::${item.english || item.explanation || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Helper: Calculate extraction statistics
function calculateExtractionStats(extraction: ChapterExtraction): ExtractionStats {
  const stats: ExtractionStats = {
    totalTranslations: 0,
    categoryCounts: {},
    pagesWithContent: [],
    missingPages: [],
    avgItemsPerPage: 0,
    grammarRules: extraction.grammarRules?.length || 0,
    exercises: extraction.exercises?.length || 0
  };
  
  const pageSet = new Set<number>();
  
  for (const [category, items] of Object.entries(extraction.translationPairs || {})) {
    stats.categoryCounts[category] = items.length;
    stats.totalTranslations += items.length;
    
    items.forEach(item => {
      if (item.page) pageSet.add(item.page);
    });
  }
  
  stats.pagesWithContent = Array.from(pageSet).sort((a, b) => a - b);
  
  if (stats.pagesWithContent.length > 0) {
    const minPage = Math.min(...stats.pagesWithContent);
    const maxPage = Math.max(...stats.pagesWithContent);
    stats.avgItemsPerPage = stats.totalTranslations / (maxPage - minPage + 1);
    
    // Find missing pages
    for (let p = minPage; p <= maxPage; p++) {
      if (!pageSet.has(p)) {
        stats.missingPages.push(p);
      }
    }
  }
  
  return stats;
}

// Helper: Estimate cost
function estimateCost(model: string, tokens: number): number {
  const costs: Record<string, { input: number; output: number }> = {
    'claude-3-opus-20240229': { input: 15, output: 75 }, // per million tokens
    'claude-3-5-sonnet-20241022': { input: 3, output: 15 }
  };
  
  const modelCost = costs[model] || { input: 3, output: 15 };
  // Rough estimate: 80% input, 20% output
  return (tokens * 0.8 * modelCost.input + tokens * 0.2 * modelCost.output) / 1_000_000;
}

// Save comparison report
async function saveComparisonReport(results: ExtractionResult[], manifest: ChapterManifest) {
  const report = {
    chapter: manifest.chapter,
    timestamp: new Date().toISOString(),
    results: results.map(r => ({
      strategy: r.strategy.name,
      model: r.strategy.model,
      stats: r.stats,
      performance: r.performance
    })),
    winner: results.reduce((best, current) => 
      current.stats.totalTranslations > best.stats.totalTranslations ? current : best
    ).strategy.name
  };
  
  await s3.send(new PutObjectCommand({
    Bucket: process.env.CONTENT_BUCKET!,
    Key: `debug/comparison-reports/ch${manifest.chapter}-${Date.now()}.json`,
    Body: JSON.stringify(report, null, 2),
    ContentType: 'application/json'
  }));
  
  console.log('\n📊 Comparison Summary:');
  console.log('┌─────────────────────────┬──────────┬────────┬─────────┬──────────┐');
  console.log('│ Strategy                │ Items    │ Pages  │ Time(s) │ Cost($)  │');
  console.log('├─────────────────────────┼──────────┼────────┼─────────┼──────────┤');
  results.forEach(r => {
    console.log(
      `│ ${r.strategy.name.padEnd(23)} │ ${
        r.stats.totalTranslations.toString().padStart(8)
      } │ ${
        `${r.stats.pagesWithContent.length}/${manifest.totalPages}`.padStart(6)
      } │ ${
        (r.performance.totalTime / 1000).toFixed(1).padStart(7)
      } │ ${
        r.performance.costEstimate.toFixed(3).padStart(8)
      } │`
    );
  });
  console.log('└─────────────────────────┴──────────┴────────┴─────────┴──────────┘');
  console.log(`\n🏆 Best extraction: ${report.winner}`);
}