// Re-export OpenSearch functionality from the dictionary lambda
// This allows the RAG lambda to use the same OpenSearch utilities

export { 
  hybridSearch, 
  createEmbedding, 
  indexToOpenSearch,
  searchSimilar 
} from '../../dictionary/opensearch';