# 🇫🇯 Fijian Language Learning App (AI-powered via AWS Bedrock)

This is an AI-powered language learning platform to help users learn the **Fijian language** interactively. It uses AWS Bedrock with Claude 3.5 Sonnet for high-quality translations and allows native speaker validation before storing data for use in future RAG-based lessons.

---

## 🧠 Features

### ✅ Current Functionality

- **/translate**  
  Accepts a Fijian phrase and uses Claude 3.5 Sonnet to translate it into English.

- **/verify**  
  Accepts a Fijian phrase and its verified English translation (e.g., by Makita, a native Fijian speaker), generates an embedding, and stores it in OpenSearch Serverless.

### 🧭 Future Roadmap

- **Training UI**  
  Native speakers (like Makita) can validate and approve translations via a friendly interface.

- **Learning UI**  
  Learners can engage with Fijian lessons using RAG (Retrieval-Augmented Generation) with tracked progress.

- **User Accounts**  
  Cognito integration will allow users to register, log in, and have personalized lesson tracking.

---

## 🏗️ Architecture

![Architecture Diagram](./fijian_language_app_architecture.png)

### Key Components

| Service | Role |
|--------|------|
| **Amazon API Gateway** | Provides `/translate` and `/verify` HTTP endpoints |
| **AWS Lambda** | Core logic to call Bedrock and manage embeddings |
| **Amazon Bedrock (Claude 3.5 Sonnet)** | Language model for translation and teaching |
| **Amazon OpenSearch Serverless** | Stores embeddings and supports semantic search |
| **Amazon S3** | (Optional) For PDF source or UI assets |
| **Amazon Cognito** (Planned) | User authentication and identity management |

---

## 🛠️ Tech Stack

- **AWS CDK (TypeScript)** – for infrastructure-as-code
- **Node.js (TypeScript)** – used in Lambda functions
- **Claude 3.5 Sonnet** – accessed via Bedrock for natural language understanding
- **Amazon OpenSearch** – vector store for verified embeddings
- **(Planned)** AWS Amplify + React or Angular – for user interface
- **(Planned)** Amazon Cognito – for user identity and progress tracking

---
