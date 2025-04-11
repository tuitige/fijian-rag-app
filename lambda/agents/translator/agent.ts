// lambda/agents/translator/agent.ts
import { v4 as uuidv4 } from 'uuid';
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { initializeAgentExecutorWithOptions } from 'langchain/agents';
import { OpenSearchTools } from '../../shared/tools/opensearch-tools';
import { TRANSLATOR_PROMPT } from './prompts';
import { TranslationRequest, TranslationResponse } from '../../shared/types/documents';

export class TranslatorAgent {
  private model: ChatOpenAI;
  private tools: OpenSearchTools;
  
  constructor() {
    this.model = new ChatOpenAI({
      modelName: process.env.MODEL_ID || 'anthropic.claude-3-sonnet-20240229-v1:0',
      temperature: 0.2
    });
    this.tools = new OpenSearchTools();
  }

  async translate(request: TranslationRequest): Promise<TranslationResponse> {
    const executor = await initializeAgentExecutorWithOptions(
      this.tools.getTools(),
      this.model,
      {
        agentType: "chat-conversational-react-description",
        agentArgs: {
          systemMessage: TRANSLATOR_PROMPT
        }
      }
    );

    // First, check for similar translations
    const searchResult = await executor.call({
      input: `Search for similar translations of: ${request.sourceText}`
    });

    // If no similar translation found, create new translation
    const translationResult = await executor.call({
      input: `Translate from ${request.sourceLanguage} to ${request.targetLanguage}: ${request.sourceText}
              Context: ${request.context || 'None provided'}`
    });

    // Parse and format the response
    const translation = this.parseTranslationResult(translationResult.output);
    
    // Save the translation
    const document = {
      id: uuidv4(),
      type: 'translation',
      sourceText: request.sourceText,
      targetText: translation.targetText,
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
      confidence: translation.confidence,
      verified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        context: request.context
      }
    };

    await this.tools.getTools()
      .find(tool => tool.name === 'save_translation')
      ?.call(JSON.stringify(document));

    return {
      id: document.id,
      sourceText: document.sourceText,
      targetText: document.targetText,
      sourceLanguage: document.sourceLanguage,
      targetLanguage: document.targetLanguage,
      confidence: document.confidence,
      needsVerification: translation.needsVerification,
      createdAt: document.createdAt
    };
  }

  private parseTranslationResult(result: string): {
    targetText: string;
    confidence: number;
    needsVerification: boolean;
    notes?: string;
  } {
    try {
      return JSON.parse(result);
    } catch (error) {
      // Fallback parsing if the model doesn't return proper JSON
      return {
        targetText: result,
        confidence: 0.7,
        needsVerification: true,
        notes: 'Parsed from unstructured response'
      };
    }
  }
}
