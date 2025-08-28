/**
 * Dedicated Lambda for Dictionary PDF Ingestion Pipeline
 * 
 * This Lambda is specifically designed to handle dictionary PDF uploads from S3
 * and process them through the FijianDictionaryProcessor pipeline.
 * 
 * Triggered by:
 * - S3 uploads with 'dictionary/' prefix and '.pdf' suffix
 * - API Gateway events for manual processing
 */

import { S3Event } from 'aws-lambda';

export const handler = async (event: S3Event | any) => {
  console.log('Dictionary PDF processing event received:', JSON.stringify(event, null, 2));

  try {
    // Import the dictionary processor handler
    const { processDictionaryHandler } = await import('../dictionary/processor');
    
    // Check if this is an S3 event (PDF upload)
    if (event.Records && event.Records[0]?.eventSource === 'aws:s3') {
      const record = event.Records[0];
      const bucketName = record.s3.bucket.name;
      const objectKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
      
      console.log(`Processing dictionary PDF from S3: s3://${bucketName}/${objectKey}`);
      
      // Only process PDF files
      if (!objectKey.toLowerCase().endsWith('.pdf')) {
        console.log('Skipping non-PDF file:', objectKey);
        return { statusCode: 200, body: 'File skipped - not a PDF' };
      }
      
      // Only process files in dictionary directory
      if (!objectKey.toLowerCase().includes('dictionary')) {
        console.log('Skipping file outside dictionary scope:', objectKey);
        return { statusCode: 200, body: 'File skipped - outside dictionary scope' };
      }
      
      // Process the PDF
      return await processDictionaryHandler(event);
    }
    
    // Check if this is an API Gateway event
    if (event.httpMethod && event.path) {
      console.log('API Gateway event detected for dictionary processing');
      return await processDictionaryHandler(event);
    }
    
    // Direct Lambda invocation for PDF processing
    if (event.action === 'process_pdf' && event.s3Key) {
      console.log('Direct PDF processing invocation:', event.s3Key);
      return await processDictionaryHandler(event);
    }
    
    console.warn('Unsupported event type for dictionary PDF processing');
    return { 
      statusCode: 400, 
      body: JSON.stringify({
        error: 'Unsupported event type',
        message: 'This Lambda only processes dictionary PDFs from S3 or API Gateway requests'
      })
    };
    
  } catch (error: any) {
    console.error('Dictionary PDF processing failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Dictionary PDF processing failed',
        message: error.message
      })
    };
  }
};