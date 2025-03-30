# 🇫🇯 Fijian Language Learning App (AI-powered via AWS Bedrock)

## 🌺 About the Project

This is an AI-powered language learning platform designed to help users learn the **Fijian language** (also known as *Bauan* or *Standard Fijian*) in an interactive, accurate, and culturally respectful way.

Fijian is the official language of Fiji and is spoken by over **350,000 native speakers**, with additional speakers across the Pacific diaspora. Despite its importance in Fiji's national identity, Fijian is **underrepresented in large language models**, educational platforms like Duolingo, and global language learning tools.

### 🤖 Why AI + Human-in-the-Loop?

Because Fijian is a **low-resource language**, it often suffers from:

- Inaccurate translations from mainstream LLMs
- Limited digital resources for grammar, syntax, and idioms
- Cultural nuances being lost or distorted

This system uses:

- **Amazon Bedrock with Claude 3.5 Sonnet** for high-quality translation and conversational AI
- **Human validation (by Makita, a native Fijian speaker)** to ensure accuracy and cultural relevance
- **Retrieval-Augmented Generation (RAG)** architecture to deliver lessons and explanations based on validated phrases

The combination of machine learning and native speaker expertise allows us to build a **custom, high-fidelity language learning experience**, especially suited for low-resource languages like Fijian.

This app is especially valuable for:

- Learners who want conversational or travel-ready Fijian
- Heritage speakers reconnecting with their roots
- Researchers or developers exploring RAG-based language learning systems

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

![Architecture Diagram](/Fijian-RAG-App-diagram-v1.png)

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
