// scripts/upload-manual-pages.ts
/*
example usage:
npx ts-node scripts/upload-manual-pages.ts \
  --chapter 2.5 \
  --topic telling_time \
  --start-page 37 \
  --directory "H:\My Drive\Personal File Cabinet\IT-Tech\Fijian-Language-AI\Fijian Reference Grammar\Peace Corp Lesson 2.5" `
  --bucket fijian-rag-content-bucket \
  --profile default




*/

import * as fs from 'fs';
import * as path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { program } from 'commander';
import { fromIni } from '@aws-sdk/credential-provider-ini';

interface UploadOptions {
  chapter: string;
  topic: string;
  startPage: number;
  directory: string;
  bucket: string;
  profile?: string;
}


program
  .requiredOption('-c, --chapter <chapter>', 'Chapter number (e.g., 2.5)')
  .requiredOption('-t, --topic <topic>', 'Topic name (e.g., telling_time)')
  .requiredOption('-s, --start-page <number>', 'Starting page number')
  .requiredOption('-d, --directory <path>', 'Directory containing images')
  .requiredOption('-b, --bucket <name>', 'S3 bucket name')
  .option('-p, --profile <profile>', 'AWS profile to use')
  .parse();

const options = program.opts() as UploadOptions;

// Configure AWS
const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-west-2',
  credentials: options.profile ? fromIni({ profile: options.profile }) : undefined,
});

async function uploadManualPages(options: UploadOptions) {
  const { chapter, topic, startPage, directory, bucket } = options;
  
  console.log(`Processing chapter ${chapter} - ${topic}`);
  console.log(`Directory: ${directory}`);
  console.log(`Target bucket: ${bucket}`);
  
  // Get all image files
  const files = fs.readdirSync(directory)
    .filter(file => /\.(jpg|jpeg|png)$/i.test(file))
    .sort((a, b) => {
      // Natural sort for files
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });
  
  if (files.length === 0) {
    console.error('No image files found in directory');
    process.exit(1);
  }
  
  console.log(`Found ${files.length} image files`);
  
  // Prepare S3 paths
  const chapterFormatted = chapter.replace('.', '-');
  const s3Prefix = `manuals/peace-corps/${chapterFormatted}/${topic}`;
  
  const uploadedFiles: string[] = [];
  let pageNum = parseInt(startPage.toString());
  
  // Upload each file
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const pageFormatted = pageNum.toString().padStart(3, '0');
    
    // New filename format
    const newName = `peace_corps_fiji_ch${chapter.replace('.', '_')}_p${pageFormatted}_${topic}${ext}`;
    const s3Key = `${s3Prefix}/${newName}`;
    
    console.log(`Uploading ${file} as ${newName}...`);
    
    try {
      const fileContent = fs.readFileSync(path.join(directory, file));
      
      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: s3Key,
        Body: fileContent,
        ContentType: `image/${ext.substring(1)}`,
        Metadata: {
          originalFilename: file,
          chapter: chapter,
          page: pageNum.toString(),
          topic: topic
        }
      }));
      
      uploadedFiles.push(newName);
      console.log(`✓ Uploaded ${newName}`);
      
    } catch (error) {
      console.error(`✗ Failed to upload ${file}:`, error);
      process.exit(1);
    }
    
    pageNum++;
  }
  
  // Create and upload manifest
  const manifest = {
    chapter,
    topic,
    startPage: parseInt(startPage.toString()),
    totalPages: files.length,
    timestamp: new Date().toISOString(),
    files: uploadedFiles,
    s3Prefix: `s3://${bucket}/${s3Prefix}/`
  };
  
  const manifestKey = `${s3Prefix}/manifest.json`;
  
  console.log('\nUploading manifest.json...');
  
  try {
    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: manifestKey,
      Body: JSON.stringify(manifest, null, 2),
      ContentType: 'application/json'
    }));
    
    console.log('✓ Manifest uploaded successfully');
    console.log(`\nAll files uploaded to: s3://${bucket}/${s3Prefix}/`);
    console.log('\nManifest location:', `s3://${bucket}/${manifestKey}`);
    console.log('\nThe Lambda will be triggered automatically to process this chapter.');
    
  } catch (error) {
    console.error('✗ Failed to upload manifest:', error);
    process.exit(1);
  }
}

// Run the upload
uploadManualPages(options).catch(error => {
  console.error('\nUpload failed:', error);
  process.exit(1);
});

// Usage example:
// npx ts-node scripts/upload-manual-pages.ts \
//   --chapter 2.5 \
//   --topic telling_time \
//   --start-page 37 \
//   --directory ./manual-photos \
//   --bucket fijian-rag-content-bucket