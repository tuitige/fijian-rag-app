const axios = require('axios');
const cheerio = require('cheerio');

const ARTICLE_URL = 'https://www.fijitimes.com.fj/yavu-ni-veiqaravi-o-keda-kei-na-iyaubula/';
const INGEST_API = 'https://dj00dl39fh.execute-api.us-west-2.amazonaws.com/prod';

(async () => {
  try {
    const res = await axios.get(ARTICLE_URL);
    const $ = cheerio.load(res.data);

    const paragraphs = [];

    $('.entry-content p').each((_, el) => {
      const text = $(el).text().trim();
      if (text) paragraphs.push(text);
    });

    console.log(`📄 Extracted ${paragraphs.length} paragraphs`);

    const title = $('title').text().split('|')[0].trim();

    const response = await axios.post(INGEST_API, {
      title,
      paragraphs
    });

    console.log('✅ Ingested article:', response.data);
  } catch (err) {
    console.error('❌ Failed:', err.message);
  }
})();
