# DynamoDB GSI Deployment Steps

Due to DynamoDB's limitation of only allowing one GSI creation/deletion at a time, we need to deploy the GSIs in multiple steps:

1. First deployment (current state in code):
   - Deploy with only the 'VerifiedIndex' GSI

2. Second deployment:
   - After the first deployment succeeds, uncomment and add the 'VerifiedLanguageIndex' GSI
   - Deploy again

3. Final deployment:
   - After the second deployment succeeds, uncomment and add the 'CreatedAtIndex' GSI
   - Deploy one final time

After each successful deployment, update the stack file with the next GSI and deploy again. Here are the GSIs to add in order:

```typescript
// Second deployment - add this GSI
translationsTable.addGlobalSecondaryIndex({
  indexName: 'VerifiedLanguageIndex',
  partitionKey: { name: 'verified', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'sourceLanguage', type: dynamodb.AttributeType.STRING },
  projectionType: dynamodb.ProjectionType.ALL
});

// Third deployment - add this GSI
translationsTable.addGlobalSecondaryIndex({
  indexName: 'CreatedAtIndex',
  partitionKey: { name: 'sourceLanguage', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
  projectionType: dynamodb.ProjectionType.ALL
});
```