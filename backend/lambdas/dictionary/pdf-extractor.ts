/**
 * PDF Text Extraction Service
 * 
 * Handles PDF parsing and text extraction using AWS Textract
 * Provides structured text extraction with OCR error handling
 */

import { TextractClient, DetectDocumentTextCommand, Block } from '@aws-sdk/client-textract';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';

const textractClient = new TextractClient({});
const s3Client = new S3Client({});

export interface ExtractionResult {
  rawText: string;
  structuredText: ExtractedBlock[];
  confidence: number;
  pageCount: number;
  errors: string[];
  metadata: {
    filename: string;
    extractionTime: string;
    method: 'textract' | 'fallback';
    s3Key?: string;
  };
}

export interface ExtractedBlock {
  text: string;
  confidence: number;
  blockType: 'LINE' | 'WORD' | 'PAGE';
  pageNumber: number;
  boundingBox?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

export class PDFExtractor {
  private bucketName: string;
  private s3Prefix: string;

  constructor(bucketName: string, s3Prefix: string = 'dictionary-processing/') {
    this.bucketName = bucketName;
    this.s3Prefix = s3Prefix;
  }

  /**
   * Extract text from PDF using AWS Textract
   */
  async extractFromPDF(pdfPath: string): Promise<ExtractionResult> {
    const filename = path.basename(pdfPath);
    const extractionTime = new Date().toISOString();
    
    console.log(`Starting PDF extraction for: ${filename}`);
    
    try {
      // Read PDF file
      const pdfBuffer = fs.readFileSync(pdfPath);
      
      // Store original PDF in S3 for traceability
      const originalS3Key = `${this.s3Prefix}originals/${filename}`;
      await this.storeInS3(originalS3Key, pdfBuffer, 'application/pdf');
      
      // Extract text using Textract
      const textractResult = await this.extractWithTextract(pdfBuffer);
      
      // Process and structure the results
      const result: ExtractionResult = {
        rawText: textractResult.rawText,
        structuredText: textractResult.blocks,
        confidence: textractResult.averageConfidence,
        pageCount: textractResult.pageCount,
        errors: textractResult.errors,
        metadata: {
          filename,
          extractionTime,
          method: 'textract',
          s3Key: originalS3Key
        }
      };
      
      // Store extraction results in S3
      await this.storeExtractionResults(result);
      
      console.log(`PDF extraction completed. Pages: ${result.pageCount}, Confidence: ${result.confidence.toFixed(2)}`);
      
      return result;
      
    } catch (error) {
      console.error(`PDF extraction failed for ${filename}:`, error);
      
      // Return error result
      return {
        rawText: '',
        structuredText: [],
        confidence: 0,
        pageCount: 0,
        errors: [`Extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        metadata: {
          filename,
          extractionTime,
          method: 'fallback'
        }
      };
    }
  }

  /**
   * Extract text from PDF using AWS Textract
   */
  private async extractWithTextract(pdfBuffer: Buffer): Promise<{
    rawText: string;
    blocks: ExtractedBlock[];
    averageConfidence: number;
    pageCount: number;
    errors: string[];
  }> {
    const command = new DetectDocumentTextCommand({
      Document: {
        Bytes: pdfBuffer
      }
    });

    const response = await textractClient.send(command);
    
    if (!response.Blocks) {
      throw new Error('No blocks returned from Textract');
    }

    const blocks: ExtractedBlock[] = [];
    const confidences: number[] = [];
    const errors: string[] = [];
    let pageCount = 0;
    let rawText = '';

    // Process Textract blocks
    for (const block of response.Blocks) {
      if (block.BlockType === 'PAGE') {
        pageCount++;
      }
      
      if (block.BlockType === 'LINE' && block.Text) {
        const confidence = block.Confidence || 0;
        
        // Track low confidence blocks
        if (confidence < 80) {
          errors.push(`Low confidence (${confidence.toFixed(1)}%) for text: "${block.Text}"`);
        }

        blocks.push({
          text: block.Text,
          confidence,
          blockType: 'LINE',
          pageNumber: this.getPageNumber(block),
          boundingBox: this.getBoundingBox(block)
        });

        confidences.push(confidence);
        rawText += block.Text + '\n';
      }
    }

    const averageConfidence = confidences.length > 0 
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length 
      : 0;

    return {
      rawText: rawText.trim(),
      blocks,
      averageConfidence,
      pageCount,
      errors
    };
  }

  /**
   * Extract text from S3-stored PDF
   */
  async extractFromS3(s3Key: string): Promise<ExtractionResult> {
    console.log(`Extracting PDF from S3: ${s3Key}`);
    
    try {
      // Download PDF from S3
      const getObjectCommand = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key
      });
      
      const response = await s3Client.send(getObjectCommand);
      
      if (!response.Body) {
        throw new Error('No content in S3 object');
      }
      
      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      const reader = response.Body.transformToByteArray();
      const pdfBuffer = Buffer.from(await reader);
      
      // Extract using Textract
      const textractResult = await this.extractWithTextract(pdfBuffer);
      
      const result: ExtractionResult = {
        rawText: textractResult.rawText,
        structuredText: textractResult.blocks,
        confidence: textractResult.averageConfidence,
        pageCount: textractResult.pageCount,
        errors: textractResult.errors,
        metadata: {
          filename: path.basename(s3Key),
          extractionTime: new Date().toISOString(),
          method: 'textract',
          s3Key
        }
      };
      
      // Store extraction results
      await this.storeExtractionResults(result);
      
      return result;
      
    } catch (error) {
      console.error(`S3 PDF extraction failed for ${s3Key}:`, error);
      throw error;
    }
  }

  /**
   * Store extraction results in S3 for traceability
   */
  private async storeExtractionResults(result: ExtractionResult): Promise<void> {
    const resultsKey = `${this.s3Prefix}extractions/${result.metadata.filename}-${Date.now()}.json`;
    
    const resultsData = {
      ...result,
      // Don't store the full structured text in the summary
      structuredTextSample: result.structuredText.slice(0, 10),
      structuredTextCount: result.structuredText.length
    };
    
    await this.storeInS3(resultsKey, JSON.stringify(resultsData, null, 2), 'application/json');
    
    // Also store raw text separately
    const rawTextKey = `${this.s3Prefix}raw-text/${result.metadata.filename}-${Date.now()}.txt`;
    await this.storeInS3(rawTextKey, result.rawText, 'text/plain');
    
    console.log(`Extraction results stored: ${resultsKey}`);
  }

  /**
   * Store data in S3
   */
  private async storeInS3(key: string, data: string | Buffer, contentType: string): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: data,
      ContentType: contentType,
      Metadata: {
        'extraction-timestamp': new Date().toISOString(),
        'source': 'fijian-dictionary-processor'
      }
    });

    await s3Client.send(command);
  }

  /**
   * Get page number from Textract block
   */
  private getPageNumber(block: Block): number {
    // For multi-page documents, this would need more sophisticated logic
    // For now, assume single page or use relationships
    return 1;
  }

  /**
   * Extract bounding box from Textract block
   */
  private getBoundingBox(block: Block): { left: number; top: number; width: number; height: number } | undefined {
    if (!block.Geometry?.BoundingBox) {
      return undefined;
    }

    const bbox = block.Geometry.BoundingBox;
    return {
      left: bbox.Left || 0,
      top: bbox.Top || 0,
      width: bbox.Width || 0,
      height: bbox.Height || 0
    };
  }
}