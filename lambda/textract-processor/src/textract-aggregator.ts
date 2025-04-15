import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";

const s3 = new S3Client({ region: process.env.AWS_REGION });

const streamToString = async (stream: Readable): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", chunk => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    stream.on("error", reject);
  });

exports.handler = async (event: any) => {
  const bucket = process.env.BUCKET_NAME!;
  const prefix = decodeURIComponent(event.queryStringParameters?.prefix || "");

  console.log(`📁 Aggregating files in prefix: ${prefix}`);

  const listCommand = new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix });
  const listResult = await s3.send(listCommand);

  const files = (listResult.Contents || [])
    .filter(obj => obj.Key?.endsWith(".json") && obj.Key.includes("pg"))
    .sort((a, b) => (a.Key! > b.Key! ? 1 : -1));

  const allParagraphs: string[] = [];

  for (const file of files) {
    console.log(`🔍 Reading file: ${file.Key}`);
    const getCommand = new GetObjectCommand({ Bucket: bucket, Key: file.Key! });
    const fileData = await s3.send(getCommand);
    const body = await streamToString(fileData.Body as Readable);
    const json = JSON.parse(body);
    console.log(`🔍 File content: ${json}`);

    const paragraphs = (json?.paragraphs || []).map((p: any) => p.S ?? "").filter(Boolean);

    console.log(`📄 Found ${paragraphs.length} paragraphs in ${file.Key}`);
    allParagraphs.push(...paragraphs);
  }

  const fullText = allParagraphs.join("\n\n");
  console.log(`📝 Final merged paragraph count: ${allParagraphs.length}`);
  const moduleTitle = prefix.split("/").filter(Boolean).pop();

  const result = {
    title: moduleTitle,
    paragraphs: allParagraphs,
    fullText,
  };

  const outputKey = `aggregated/${moduleTitle}/chapterText.json`;
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: outputKey,
      Body: JSON.stringify(result, null, 2),
      ContentType: "application/json",
    })
  );

  return {
    statusCode: 200,
    body: JSON.stringify({ message: `Merged ${files.length} files to ${outputKey}` }),
  };
};
