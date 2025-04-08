"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TABLE_NAME = void 0;
exports.main = main;
// lambda/handler.ts
var client_bedrock_runtime_1 = require("@aws-sdk/client-bedrock-runtime");
var client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
var lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
var uuid_1 = require("uuid");
// Constants
exports.TABLE_NAME = process.env.TABLE_NAME || 'TranslationsTable';
// Initialize AWS clients
var ddb = lib_dynamodb_1.DynamoDBDocument.from(new client_dynamodb_1.DynamoDB());
var bedrock = new client_bedrock_runtime_1.BedrockRuntimeClient({ region: 'us-west-2' });
// Helper functions
function getEmbedding(text) {
    return __awaiter(this, void 0, void 0, function () {
        var command, response, embedding;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    command = new client_bedrock_runtime_1.InvokeModelCommand({
                        modelId: 'amazon.titan-embed-text-v1',
                        contentType: 'application/json',
                        body: JSON.stringify({
                            inputText: text
                        })
                    });
                    return [4 /*yield*/, bedrock.send(command)];
                case 1:
                    response = _a.sent();
                    embedding = JSON.parse(new TextDecoder().decode(response.body)).embedding;
                    return [2 /*return*/, embedding];
            }
        });
    });
}
function cosineSimilarity(vecA, vecB) {
    var dotProduct = vecA.reduce(function (acc, val, i) { return acc + val * vecB[i]; }, 0);
    var magnitudeA = Math.sqrt(vecA.reduce(function (acc, val) { return acc + val * val; }, 0));
    var magnitudeB = Math.sqrt(vecB.reduce(function (acc, val) { return acc + val * val; }, 0));
    return dotProduct / (magnitudeA * magnitudeB);
}
function translateWithClaude(text, sourceLanguage) {
    return __awaiter(this, void 0, void 0, function () {
        var prompt, command, response, result, parsedResponse, rawText;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    prompt = sourceLanguage === 'fj'
                        ? "Translate this Fijian text to English. Provide your response in JSON format with two fields:\n       1. \"translation\" - containing only the direct translation\n       2. \"notes\" - containing any explanatory notes, context, or alternative translations\n       Input text: \"".concat(text, "\"")
                        : "Translate this English text to Fijian. Provide your response in JSON format with two fields:\n       1. \"translation\" - containing only the direct translation\n       2. \"notes\" - containing any explanatory notes, context, or alternative translations\n       Input text: \"".concat(text, "\"");
                    command = new client_bedrock_runtime_1.InvokeModelCommand({
                        modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
                        contentType: 'application/json',
                        body: JSON.stringify({
                            anthropic_version: "bedrock-2023-05-31",
                            max_tokens: 1000,
                            messages: [
                                {
                                    role: "user",
                                    content: prompt
                                }
                            ],
                            temperature: 0.1
                        })
                    });
                    return [4 /*yield*/, bedrock.send(command)];
                case 1:
                    response = _a.sent();
                    result = JSON.parse(new TextDecoder().decode(response.body));
                    try {
                        parsedResponse = JSON.parse(result.content[0].text);
                        return [2 /*return*/, {
                                translation: parsedResponse.translation.trim(),
                                rawResponse: result.content[0].text,
                                confidence: result.confidence || undefined
                            }];
                    }
                    catch (e) {
                        // Fallback if Claude doesn't return valid JSON
                        console.warn('Failed to parse Claude response as JSON:', e);
                        rawText = result.content[0].text;
                        return [2 /*return*/, {
                                translation: rawText.replace(/^.*?"|\n|"$/g, '').trim(),
                                rawResponse: rawText,
                                confidence: result.confidence || undefined
                            }];
                    }
                    return [2 /*return*/];
            }
        });
    });
}
function findSimilarTranslations(text_1, sourceLanguage_1) {
    return __awaiter(this, arguments, void 0, function (text, sourceLanguage, threshold) {
        var queryEmbedding, result, withSimilarity, filtered;
        if (threshold === void 0) { threshold = 0.85; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getEmbedding(text)];
                case 1:
                    queryEmbedding = _a.sent();
                    return [4 /*yield*/, ddb.query({
                            TableName: exports.TABLE_NAME,
                            IndexName: 'SourceLanguageIndex',
                            KeyConditionExpression: 'sourceLanguage = :sl',
                            ExpressionAttributeValues: {
                                ':sl': sourceLanguage
                            }
                        })];
                case 2:
                    result = _a.sent();
                    if (!result.Items)
                        return [2 /*return*/, { translations: [], similarities: [] }];
                    withSimilarity = result.Items.map(function (item) { return ({
                        translation: item,
                        similarity: cosineSimilarity(queryEmbedding, item.sourceLanguage === sourceLanguage ?
                            item.sourceEmbedding : item.translationEmbedding)
                    }); });
                    filtered = withSimilarity
                        .filter(function (item) { return item.similarity >= threshold; })
                        .sort(function (a, b) { return b.similarity - a.similarity; });
                    return [2 /*return*/, {
                            translations: filtered.map(function (item) { return item.translation; }),
                            similarities: filtered.map(function (item) { return item.similarity; })
                        }];
            }
        });
    });
}
function main(event) {
    return __awaiter(this, void 0, void 0, function () {
        var path, body, parsedBody, _a, sourceText, sourceLanguage, sourceEmbedding_1, queryResult, similarTranslations, translatedText, rawResponse, confidence, useVerified, SIMILARITY_THRESHOLD_1, verifiedTranslation, claudeResponse, translationEmbedding, id, currentDate, newTranslation, response, sourceText, translatedText, sourceLanguage, _b, verified, id, _c, sourceEmbedding, translationEmbedding, newTranslation, _d, sourceLanguage, category, queryParams, result, error_1;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    _e.trys.push([0, 15, , 16]);
                    path = event.path, body = event.body;
                    parsedBody = JSON.parse(body || '{}');
                    console.log('Received event:', event);
                    console.log('Parsed body:', parsedBody);
                    _a = path;
                    switch (_a) {
                        case '/translate': return [3 /*break*/, 1];
                        case '/verify': return [3 /*break*/, 8];
                        case '/learn': return [3 /*break*/, 11];
                    }
                    return [3 /*break*/, 13];
                case 1:
                    sourceText = parsedBody.sourceText, sourceLanguage = parsedBody.sourceLanguage;
                    // Validate required fields
                    if (!sourceText || !sourceLanguage) {
                        return [2 /*return*/, {
                                statusCode: 400,
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Access-Control-Allow-Origin': '*'
                                },
                                body: JSON.stringify({
                                    message: 'Missing required fields: sourceText and sourceLanguage are required'
                                })
                            }];
                    }
                    // Validate sourceLanguage is either 'en' or 'fj'
                    if (!['en', 'fj'].includes(sourceLanguage)) {
                        return [2 /*return*/, {
                                statusCode: 400,
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Access-Control-Allow-Origin': '*'
                                },
                                body: JSON.stringify({
                                    message: 'sourceLanguage must be either "en" or "fj"'
                                })
                            }];
                    }
                    return [4 /*yield*/, getEmbedding(sourceText)];
                case 2:
                    sourceEmbedding_1 = _e.sent();
                    return [4 /*yield*/, ddb.query({
                            TableName: exports.TABLE_NAME,
                            IndexName: 'SourceLanguageIndex',
                            KeyConditionExpression: 'sourceLanguage = :sl',
                            ExpressionAttributeValues: {
                                ':sl': sourceLanguage
                            }
                        })];
                case 3:
                    queryResult = _e.sent();
                    similarTranslations = [];
                    translatedText = void 0;
                    rawResponse = void 0;
                    confidence = void 0;
                    useVerified = false;
                    if (queryResult.Items) {
                        SIMILARITY_THRESHOLD_1 = 0.85;
                        similarTranslations = queryResult.Items
                            .map(function (item) { return (__assign(__assign({}, item), { similarity: cosineSimilarity(sourceEmbedding_1, item.sourceEmbedding) })); })
                            .filter(function (item) { return item.similarity >= SIMILARITY_THRESHOLD_1; })
                            .sort(function (a, b) { return b.similarity - a.similarity; });
                        verifiedTranslation = similarTranslations.find(function (item) { return item.verified === 'true'; });
                        if (verifiedTranslation) {
                            useVerified = true;
                            translatedText = verifiedTranslation.translation;
                            rawResponse = JSON.stringify({
                                translation: verifiedTranslation.translation,
                                notes: "Using verified translation (similarity: ".concat(verifiedTranslation.similarity.toFixed(3), ")")
                            });
                            confidence = 1.0;
                        }
                    }
                    if (!!useVerified) return [3 /*break*/, 5];
                    return [4 /*yield*/, translateWithClaude(sourceText, sourceLanguage)];
                case 4:
                    claudeResponse = _e.sent();
                    translatedText = claudeResponse.translation;
                    rawResponse = claudeResponse.rawResponse;
                    confidence = claudeResponse.confidence;
                    _e.label = 5;
                case 5: return [4 /*yield*/, getEmbedding(translatedText)];
                case 6:
                    translationEmbedding = _e.sent();
                    id = (0, uuid_1.v4)();
                    currentDate = new Date().toISOString();
                    newTranslation = {
                        id: id,
                        sourceText: sourceText,
                        translation: translatedText,
                        sourceLanguage: sourceLanguage,
                        sourceEmbedding: sourceEmbedding_1,
                        translationEmbedding: translationEmbedding,
                        verified: useVerified ? 'true' : 'false',
                        createdAt: currentDate,
                        verificationDate: currentDate
                    };
                    return [4 /*yield*/, ddb.put({
                            TableName: exports.TABLE_NAME,
                            Item: newTranslation
                        })];
                case 7:
                    _e.sent();
                    response = {
                        translatedText: translatedText,
                        rawResponse: rawResponse,
                        confidence: confidence,
                        id: id,
                        similarTranslations: similarTranslations.length,
                        debug: {
                            foundSimilarTranslations: similarTranslations.map(function (item) { return ({
                                id: item.id,
                                sourceText: item.sourceText,
                                translatedText: item.translation,
                                verified: item.verified,
                                createdAt: item.createdAt,
                                similarity: item.similarity
                            }); })
                        }
                    };
                    return [2 /*return*/, {
                            statusCode: 200,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*'
                            },
                            body: JSON.stringify(response)
                        }];
                case 8:
                    sourceText = parsedBody.sourceText, translatedText = parsedBody.translatedText, sourceLanguage = parsedBody.sourceLanguage, _b = parsedBody.verified, verified = _b === void 0 ? true : _b;
                    // Validate required fields
                    if (!sourceText || !translatedText || !sourceLanguage) {
                        return [2 /*return*/, {
                                statusCode: 400,
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Access-Control-Allow-Origin': '*'
                                },
                                body: JSON.stringify({
                                    message: 'Missing required fields: sourceText, translatedText, and sourceLanguage are required'
                                })
                            }];
                    }
                    // Validate sourceLanguage is either 'en' or 'fj'
                    if (!['en', 'fj'].includes(sourceLanguage)) {
                        return [2 /*return*/, {
                                statusCode: 400,
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Access-Control-Allow-Origin': '*'
                                },
                                body: JSON.stringify({
                                    message: 'sourceLanguage must be either "en" or "fj"'
                                })
                            }];
                    }
                    id = (0, uuid_1.v4)();
                    console.log('Verifying translation:', {
                        sourceText: sourceText,
                        translatedText: translatedText,
                        sourceLanguage: sourceLanguage
                    });
                    return [4 /*yield*/, Promise.all([
                            getEmbedding(sourceText),
                            getEmbedding(translatedText)
                        ])];
                case 9:
                    _c = _e.sent(), sourceEmbedding = _c[0], translationEmbedding = _c[1];
                    newTranslation = {
                        id: id,
                        sourceText: sourceText,
                        translation: translatedText,
                        sourceLanguage: sourceLanguage,
                        sourceEmbedding: sourceEmbedding,
                        translationEmbedding: translationEmbedding,
                        verified: 'true',
                        createdAt: new Date().toISOString(),
                        verificationDate: new Date().toISOString()
                    };
                    return [4 /*yield*/, ddb.put({
                            TableName: exports.TABLE_NAME,
                            Item: newTranslation
                        })];
                case 10:
                    _e.sent();
                    return [2 /*return*/, {
                            statusCode: 200,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*'
                            },
                            body: JSON.stringify({
                                message: 'Translation verified successfully',
                                id: id
                            })
                        }];
                case 11:
                    _d = parsedBody.sourceLanguage, sourceLanguage = _d === void 0 ? 'fj' : _d, category = parsedBody.category;
                    queryParams = {
                        TableName: exports.TABLE_NAME,
                        IndexName: 'SourceLanguageIndex',
                        KeyConditionExpression: 'sourceLanguage = :sl',
                        ExpressionAttributeValues: {
                            ':sl': sourceLanguage,
                            ':v': 'true'
                        },
                        FilterExpression: 'verified = :v'
                    };
                    if (category) {
                        queryParams.FilterExpression += ' AND category = :c';
                        queryParams.ExpressionAttributeValues[':c'] = category;
                    }
                    return [4 /*yield*/, ddb.query(queryParams)];
                case 12:
                    result = _e.sent();
                    return [2 /*return*/, {
                            statusCode: 200,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*'
                            },
                            body: JSON.stringify(result.Items)
                        }];
                case 13: return [2 /*return*/, {
                        statusCode: 404,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        },
                        body: JSON.stringify({ message: 'Not found' })
                    }];
                case 14: return [3 /*break*/, 16];
                case 15:
                    error_1 = _e.sent();
                    console.error('Error:', error_1);
                    return [2 /*return*/, {
                            statusCode: 500,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*'
                            },
                            body: JSON.stringify({ message: 'Internal server error' })
                        }];
                case 16: return [2 /*return*/];
            }
        });
    });
}
