🇫🇯 Fijian Language Learning App (AI-powered via AWS Bedrock)
🌺 About the Project
This is an AI-powered language learning platform designed to help users learn Fijian (Standard Bauan) interactively, accurately, and respectfully.

Despite its importance in Fiji's national identity, Fijian is underrepresented in global language resources.
This project uses AI + Human-in-the-Loop validation to build a high-fidelity language learning experience for Fijian speakers, learners, and researchers.

🤖 Why AI + Human-in-the-Loop?
Because Fijian is a low-resource language, it suffers from:

❌ Inaccurate translations from mainstream LLMs

❌ Limited grammar/syntax teaching resources

❌ Cultural nuance loss

This platform solves that using:

Amazon Bedrock + Claude 3.5 Sonnet for AI translation and teaching

Native speaker validation (by Makita) for cultural fidelity

RAG-based delivery using OpenSearch embeddings

Human-verified datasets continually improving the AI's accuracy

✅ Machine + Human = Trustworthy, respectful Fijian AI learning.

🧠 Core Features
✅ Current System
/translate
➔ Translate Fijian phrases to English (via Claude 3.5)

/verify
➔ Accept human-verified translations ➔ Store embeddings in OpenSearch

/learn
➔ Interactive chat-based learning sessions built from Peace Corps and grammar modules

/aggregate (new!)
➔ Aggregate OCR'd pages into full lessons

Automated Data Ingestion Pipeline:

OCR Peace Corps & Grammar book scans (Textract)

Aggregation of OCR pages into chapters

Claude module generation and phrase extraction

DynamoDB staging for human verification

🧭 Roadmap (Next Phases)
🖥️ Training UI for Makita (Verify and correct translations easily)

📚 Learning UI for students (Chatbot-like structured lessons)

🧑‍🤝‍🧑 User accounts (AWS Cognito login and lesson tracking)

🎙️ Audio dataset creation (Makita reading verified phrases, for future TTS training)

📈 Dashboard (Track number of verified phrases, training volume, etc.)

🏗️ Architecture Overview
(Updated diagram to be inserted here)


Component	Role
Amazon API Gateway	Entry points /translate, /verify, /learn, /aggregate
AWS Lambda	Core application logic
Amazon Bedrock (Claude 3.5 Sonnet)	Translation, module generation, phrase extraction
Amazon OpenSearch Serverless	Verified embeddings storage and retrieval
Amazon S3	Raw OCR storage, scanned documents
Amazon DynamoDB	Verified and unverified translation staging, learning modules
Amazon SQS	Queueing ingestion and aggregation steps (new!)
AWS Textract	OCR of scanned textbook pages
AWS Amplify + Angular (planned)	UI for students and verifiers
Amazon Cognito (planned)	Authentication and lesson tracking
📊 Data Ingestion Pipeline (New!)
Overview
We built a scalable, asynchronous ingestion system to handle scanned Fijian language materials at production-grade scale.

✅ Handles Peace Corps, Fijian Reference Grammar, Nai Lalakai articles.
✅ Fully async, no timeouts.
✅ Modular Claude enrichment steps.
