🇫🇯 Fijian AI Project

![Public-Benefit Project](https://img.shields.io/badge/public--benefit-Fijian%20AI-blueviolet)

🌍 Empowering Fijians through Language, Culture, and AI

🧠 What is the Fijian AI Project?

The Fijian AI Project is a public-benefit initiative that brings the power of Generative AI and language technologies to the Fijian people — and to anyone who wants to learn, preserve, or connect with Fijian culture.

At its core, this project aims to:

🗣️ Enable conversational and educational AI tools in the Fijian language

📚 Preserve and revitalize traditional stories, grammar, and vocabulary

🌍 Empower locals, students, and visitors with culturally respectful translation tools

🧠 Enrich global AI with underrepresented linguistic data

🔧 Tech Stack: GenAI + RAG + Fine-Tuning

Generative AI: Powered by Claude (Anthropic) via AWS Bedrock

RAG: Retrieval-Augmented Generation using OpenSearch vector embeddings

Embedding & Search: High-precision semantic search across verified Fijian-English datasets

AWS Infrastructure: Lambda, API Gateway, DynamoDB, OpenSearch, S3

Frontend: Angular + Amplify, designed for mobile and low-bandwidth environments

❗ Why Fijian Matters in AI

Fijian is a low-resource language, meaning:

Very limited high-quality digital content

Minimal representation in large AI models

Few or no TTS or ASR tools

By creating structured, verified datasets and an open pipeline, the Fijian AI Project makes the language accessible to AI models — and to future generations.

🚀 Future Roadmap

🎤 Train a Fijian Text-to-Speech engine with native voices

🧑‍🏫 Launch a full language learning app with progress tracking

🧭 Enable voice AI assistants in Fijian for tourism, schools, and government

🗃️ Create open datasets for fine-tuning multilingual models

💡 A Public-Benefit Mission

This is not a profit-driven SaaS tool. It's a digital preservation project rooted in:

Cultural identity

Linguistic justice

AI inclusion for the Pacific

We welcome grants, public funding, and partnerships with:

🇫🇯 Fijian government and education ministries

🏝️ Pacific NGOs and regional digital literacy programs

🌐 VCs and foundations focused on Indigenous or Ethical AI

## Merging Page JSON Files

1. Upload your page-level JSON files to a folder inside the S3 content bucket. A typical path looks like `manuals/lesson4.1/`.
2. Open the **MergePagesLambda** function in the AWS Lambda console.
3. Choose **Test** and configure a new event with the following JSON, adjusting the prefix to your folder:
   ```json
   { "prefix": "manuals/lesson4.1/" }
   ```
4. Run the test to invoke the lambda. It reads all `.json` files in that folder (except `chapter.json`), merges them, and writes `chapter.json` back to the same path.
5. The `chapter.json` file automatically triggers the **LoadLearningModuleJsonLambda** to ingest the module into DynamoDB and OpenSearch.

## API Key Configuration

The Angular frontend reads its API key from the `API_KEY` environment variable when the application is built. Provide this value whenever you run the Angular CLI:

```bash
# Development server
API_KEY=your-key ng serve

# Production build
API_KEY=your-key ng build
```

Set `API_KEY` in your deployment pipeline so the compiled application includes the correct key.

