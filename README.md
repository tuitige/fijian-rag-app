# 🇫🇯 Fijian Language Learning App (AI-powered via AWS Bedrock)

---

## 🌺 About the Project

This is an AI-powered language learning platform designed to help users learn **Fijian** (Standard Bauan) interactively, accurately, and respectfully.

Despite its importance in Fiji's national identity, Fijian is underrepresented in global language resources.  
This project uses **AI + Human-in-the-Loop validation** to build a **high-fidelity language learning experience** for Fijian speakers, learners, and researchers.

---

## 🤖 Why AI + Human-in-the-Loop?

Because Fijian is a **low-resource language**, it suffers from:
- ❌ Inaccurate translations from mainstream LLMs
- ❌ Limited grammar/syntax teaching resources
- ❌ Cultural nuance loss

This platform solves that using:
- **Amazon Bedrock** + **Claude 3.5 Sonnet** for AI translation and teaching
- **Native speaker validation** (by Makita) for cultural fidelity
- **RAG-based delivery** using OpenSearch embeddings
- **Human-verified datasets** continually improving the AI's accuracy

✅ Machine + Human = Trustworthy, respectful Fijian AI learning.

---

## 🧠 Core Features

### ✅ Current System

- `/translate`  
  ➔ Translate Fijian phrases to English (via Claude 3.5)

- `/verify`  
  ➔ Accept human-verified translations ➔ Store embeddings in OpenSearch

- `/learn`  
  ➔ Interactive chat-based learning sessions built from Peace Corps and Grammar modules

- `/aggregate`  
  ➔ Aggregate OCR'd pages into full chapter text for further processing

- Automated Data Ingestion Pipeline:
  - OCR Peace Corps & Grammar book scans (Textract)
  - Aggregation of OCR pages into chapters
  - Claude module generation and phrase extraction
  - DynamoDB staging for human verification

---

### 🧭 Roadmap (Next Phases)

- 🖥️ **Training UI** for Makita (verify and correct translations easily)
- 📚 **Learning UI** for students (chatbot-like structured lessons)
- 🧑‍🤝‍🧑 **User accounts** (AWS Cognito login and lesson tracking)
- 🎙️ **Audio dataset creation** (Makita reading verified phrases, for future TTS training)
- 📈 **Dashboard** (track number of verified phrases, training volume, ingestion stats)

---

## 🏗️ Architecture Overview

| Component | Role |
|:---|:---|
| Amazon API Gateway | Entry points `/translate`, `/verify`, `/learn`, `/aggregate` |
| AWS Lambda | Core application logic |
| Amazon Bedrock (Claude 3.5 Sonnet) | Translation, module generation, phrase extraction |
| Amazon OpenSearch Serverless | Verified embeddings storage and retrieval |
| Amazon S3 | Raw OCR storage, scanned documents |
| Amazon DynamoDB | Verified and unverified translation staging, learning modules |
| Amazon SQS | Queueing ingestion and aggregation steps (async) |
| AWS Textract | OCR of scanned textbook pages |
| AWS Amplify + Angular (Planned) | UI for students and verifiers |
| Amazon Cognito (Planned) | Authentication and progress tracking |

---

# 📊 Data Ingestion Pipeline

## Overview

A scalable, asynchronous ingestion system handling scanned Fijian language materials at production-grade scale.

✅ Handles Peace Corps, Fijian Reference Grammar, and Nai Lalakai articles.  
✅ Fully async, no API Gateway timeouts.  
✅ Modular Claude enrichment steps.

---

## 📚 Ingestion Pipeline Flow

```plaintext
Upload .jpg pages to S3
    ➔ S3 Event triggers Textract Processor Lambda
        ➔ OCR output .json files saved to S3
            ➔ Aggregator Lambda manually triggered (via API Gateway /aggregate)
                ➔ Aggregates OCR JSONs into full chapter text
                    ➔ Sends message into Worker SQS Queue
                        ➔ Worker Lambda downloads text
                            ➔ Calls Claude for:
                               - Learning Module generation
                               - Phrase extraction
                               ➔ Saves results to DynamoDB:
                                  - LearningModulesTable
                                  - TranslationsTable (unverified)
```

✅ Clean modular pipeline
✅ Expandable to even larger datasets later.

---

# 🛠️ Tech Stack

| Tech | Purpose |
|:---|:---|
| AWS CDK (TypeScript) | Infrastructure-as-Code |
| Node.js (TypeScript) | Lambda functions |
| Amazon Bedrock (Claude 3.5 Sonnet) | AI translations and module generation |
| Amazon OpenSearch | Vector search of verified embeddings |
| Amazon S3 | Raw file storage |
| Amazon DynamoDB | Data staging and storage |
| AWS Textract | OCR of scanned textbooks |
| AWS SQS | Async workflows for long ingestion |
| AWS Amplify + Angular | Web UI |
| AWS Cognito | Authentication and progress tracking |

---

# 📜 Usage

> Full instructions for each endpoint, Lambda function, and Amplify UI integration coming soon.

---
