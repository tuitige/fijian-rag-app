import { APIGatewayProxyHandler } from 'aws-lambda';
import axios from 'axios';
import * as cheerio from 'cheerio';

export const handler: APIGatewayProxyHandler = async (event) => {
  console.log("[scraper] Received event:", event.body);

  let url: string | undefined;

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    url = body.url;
  } catch (err) {
    return {
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
      },
      body: JSON.stringify({ error: "Invalid JSON body" })
    };
  }

  if (!url) {
    return {
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
      },
      body: JSON.stringify({ error: "Missing 'url' in request body" })
    };
  }

  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    const paragraphs: string[] = [];
    $('.entry-content p').each((_, el) => {
      const text = $(el).text().trim();
      if (text) paragraphs.push(text);
    });

    const slug = url.split('/').filter(Boolean).slice(-1)[0] || `article-${Date.now()}`;
    const articleId = slug.replace(/[^a-zA-Z0-9]/g, '-');

    console.log(`[scraper] Returning ${paragraphs.length} paragraphs for articleId: ${articleId}`);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
      },
      body: JSON.stringify({ articleId, paragraphs })
    };

  } catch (err: any) {
    console.error("[scraper] Error:", err.message);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
      },
      body: JSON.stringify({ error: "Scraping failed", detail: err.message })
    };
  }
};
