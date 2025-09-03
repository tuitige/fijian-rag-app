# 🇫🇯 Fijian AI Project

![Public-Benefit Project](https://img.shields.io/badge/public--benefit-Fijian%20AI-blueviolet)

🌍 Empowering Fijians through Language, Culture, and AI

## 🧠 What is the Fijian AI Project?

The Fijian AI Project is a public-benefit initiative that brings the power of Generative AI and language technologies to the Fijian people — and to anyone who wants to learn, preserve, or connect with Fijian culture.

At its core, this project aims to:

🗣️ Enable conversational and educational AI tools in the Fijian language

📚 Preserve and revitalize traditional stories, grammar, and vocabulary

🌍 Empower locals, students, and visitors with culturally respectful translation tools

🧠 Enrich global AI with underrepresented linguistic data

## 🏗️ Architecture Overview

This repository contains a clean MVP architecture for the Fijian RAG application:

```
fijian-rag-app/
├── frontend/                    # React frontend (to be implemented)
├── backend/
│   ├── lambdas/
│   │   ├── chat/               # Core chat & learning endpoints
│   │   ├── dictionary/         # Dictionary processing & sample data
│   │   ├── rag/                # RAG query processing with hybrid search
│   │   └── auth/               # Authentication (to be implemented)
│   └── shared/                 # Shared utilities
├── infrastructure/
│   └── cdk/                    # AWS CDK infrastructure
└── data-processing/
    └── dictionary/             # Data processing utilities (to be implemented)
```

## 🔧 Tech Stack: GenAI + RAG + Fine-Tuning

**Generative AI**: Powered by Claude (Anthropic) via AWS Bedrock

**RAG**: Complete Retrieval-Augmented Generation system with hybrid search (text + semantic)

**Embedding & Search**: Amazon Titan embeddings with OpenSearch vector storage for Fijian-English dictionary

**AWS Infrastructure**: Lambda, API Gateway, DynamoDB, OpenSearch, S3

**Frontend**: React (replacing Angular) for modern, responsive UI

## ❗ Why Fijian Matters in AI

Fijian is a low-resource language, meaning:

- Very limited high-quality digital content
- Minimal representation in large AI models
- Few or no TTS or ASR tools

By creating structured, verified datasets and an open pipeline, the Fijian AI Project makes the language accessible to AI models — and to future generations.

## 🚀 Development Setup

### Prerequisites

- Node.js 18+ 
- AWS CLI configured with appropriate credentials
- AWS CDK CLI (`npm install -g aws-cdk`)

### Quick Start

1. **Install dependencies**:
```bash
npm install
```

2. **Build the project**:
```bash
npm run build
```

3. **Deploy infrastructure**:
```bash
npm run cdk:deploy
```

### Directory Guide

- **`backend/lambdas/chat/`** - Core chat functionality using Claude Sonnet 3.5 v2
- **`backend/lambdas/dictionary/`** - Dictionary processing pipeline with sample Fijian vocabulary
- **`backend/lambdas/rag/`** - Complete RAG implementation with hybrid search and LLM generation
- **`backend/shared/`** - Shared utilities across lambda functions
- **`infrastructure/cdk/`** - AWS CDK infrastructure as code
- **`frontend/`** - React frontend application (to be implemented)
- **`scripts/`** - Local utility scripts for data processing and development

## 🔧 Local Tools & Scripts

### PDF Text Extraction

For processing text-selectable dictionary PDFs locally:

```bash
# Extract text from PDF into .txt and .json formats
node scripts/extract-pdf-text.js input.pdf [output-prefix]

# Example with the test dictionary
node scripts/extract-pdf-text.js ./data-processing/docs/Fijian-English_Dictionary.pdf fijian-dict
```

This local script provides an alternative to cloud-based OCR for text-selectable PDFs:
- **Fast & Accurate**: Near 100% accuracy for text-selectable PDFs
- **Offline Processing**: No AWS dependencies or API costs
- **Structured Output**: Both raw text and JSON blocks ready for LLM processing
- **Cross-Platform**: Works on Windows, macOS, and Linux

See [scripts/README-pdf-extraction.md](./scripts/README-pdf-extraction.md) for detailed usage instructions.

## 🤖 RAG System

The application now includes a complete Retrieval Augmented Generation system for Fijian language learning:

- **Dictionary API**: Exact word lookups and semantic search
- **RAG Queries**: Natural language questions answered using dictionary context
- **Sample Data**: 20+ Fijian vocabulary entries with pronunciation and examples
- **Hybrid Search**: Combines text matching and vector similarity

See [docs/RAG-SYSTEM.md](./docs/RAG-SYSTEM.md) for detailed documentation.

### Quick RAG Test
```bash
# Validate the RAG pipeline structure
node tests/validate-rag-pipeline.js
```

## 🔄 Migration Notes

This repository has undergone a clean slate migration to establish the MVP architecture. See [CLEANUP.md](./CLEANUP.md) for details on what was removed and preserved during the migration.

### Core Functionality Preserved

✅ Chat interface with Claude Sonnet 3.5 v2 via AWS Bedrock  
✅ Complete RAG pipeline with dictionary integration
✅ Learning module processing and indexing  
✅ AWS infrastructure definitions  
✅ Shared utility functions  

### Legacy Components Removed

❌ Angular frontend (replaced with React)  
❌ Legacy data ingestion pipelines  
❌ Human verification workflows  
❌ Experimental features and POC code  

## 🚀 Future Roadmap

🎤 Train a Fijian Text-to-Speech engine with native voices

🧑‍🏫 Launch a full language learning app with progress tracking

🧭 Enable voice AI assistants in Fijian for tourism, schools, and government

🗃️ Create open datasets for fine-tuning multilingual models

## 💡 A Public-Benefit Mission

This is not a profit-driven SaaS tool. It's a digital preservation project rooted in:

- Cultural identity
- Linguistic justice  
- AI inclusion for the Pacific

We welcome grants, public funding, and partnerships with:

🇫🇯 Fijian government and education ministries

🏝️ Pacific NGOs and regional digital literacy programs

🌐 VCs and foundations focused on Indigenous or Ethical AI

## 📚 Documentation

- [Infrastructure README](./infrastructure/cdk/README.md) - AWS CDK deployment guide
- [Cleanup Documentation](./CLEANUP.md) - Details on clean slate migration
- [Frontend README](./frontend/README.md) - React frontend setup (to be implemented)


