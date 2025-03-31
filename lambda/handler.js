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
exports.main = void 0;
// handler.ts
var opensearch_1 = require("@opensearch-project/opensearch");
var credential_provider_node_1 = require("@aws-sdk/credential-provider-node");
var aws_1 = require("@opensearch-project/opensearch/aws");
var client_bedrock_runtime_1 = require("@aws-sdk/client-bedrock-runtime");
var bedrockClient = new client_bedrock_runtime_1.BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-west-2' });
var createOpenSearchClient = function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, new opensearch_1.Client(__assign(__assign({}, (0, aws_1.AwsSigv4Signer)({
                region: process.env.AWS_REGION || 'us-west-2',
                service: 'aoss',
                getCredentials: function () { return (0, credential_provider_node_1.defaultProvider)()(); },
            })), { node: process.env.OPENSEARCH_ENDPOINT }))];
    });
}); };
// create the index if it doesn't exist
var createIndexIfNotExists = function (client) { return __awaiter(void 0, void 0, void 0, function () {
    var exists, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 4, , 5]);
                return [4 /*yield*/, client.indices.exists({
                        index: 'fijian-embeddings'
                    })];
            case 1:
                exists = _a.sent();
                if (!!exists.body) return [3 /*break*/, 3];
                return [4 /*yield*/, client.indices.create({
                        index: 'fijian-embeddings',
                        body: {
                            mappings: {
                                properties: {
                                    embedding: {
                                        type: 'knn_vector',
                                        dimension: 1536,
                                        method: {
                                            name: 'hnsw',
                                            space_type: 'l2',
                                            engine: 'faiss'
                                        }
                                    },
                                    fijian: { type: 'text' },
                                    english: { type: 'text' }
                                }
                            }
                        }
                    })];
            case 2:
                _a.sent();
                _a.label = 3;
            case 3: return [3 /*break*/, 5];
            case 4:
                error_1 = _a.sent();
                console.error('Error creating index:', error_1);
                throw error_1;
            case 5: return [2 /*return*/];
        }
    });
}); };
var getEmbedding = function (text) { return __awaiter(void 0, void 0, void 0, function () {
    var response, parsed;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, bedrockClient.send(new client_bedrock_runtime_1.InvokeModelCommand({
                    modelId: 'amazon.titan-embed-text-v1',
                    body: JSON.stringify({ inputText: text }),
                    contentType: 'application/json',
                    accept: 'application/json',
                }))];
            case 1:
                response = _a.sent();
                parsed = JSON.parse(Buffer.from(response.body).toString());
                return [2 /*return*/, parsed.embedding];
        }
    });
}); };
var translateWithClaude = function (fijianText) { return __awaiter(void 0, void 0, void 0, function () {
    var bedrockRuntime, params, command, response, responseBody;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                bedrockRuntime = new client_bedrock_runtime_1.BedrockRuntimeClient({ region: "us-west-2" });
                params = {
                    modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
                    contentType: "application/json",
                    accept: "application/json",
                    body: JSON.stringify({
                        anthropic_version: "bedrock-2023-05-31",
                        max_tokens: 1024,
                        messages: [
                            {
                                role: "user",
                                content: [
                                    {
                                        type: "text",
                                        text: "Please translate this Fijian text to English as accurately as possible: \"".concat(fijianText, "\"")
                                    }
                                ]
                            }
                        ]
                    })
                };
                command = new client_bedrock_runtime_1.InvokeModelCommand(params);
                return [4 /*yield*/, bedrockRuntime.send(command)];
            case 1:
                response = _a.sent();
                responseBody = JSON.parse(new TextDecoder().decode(response.body));
                return [2 /*return*/, responseBody.content[0].text];
        }
    });
}); };
// Store verified translation in AOSS
var storeVerifiedTranslation = function (client, fijianText, englishText) { return __awaiter(void 0, void 0, void 0, function () {
    var embedding, document;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, getEmbedding(fijianText)];
            case 1:
                embedding = _a.sent();
                document = {
                    fijian: fijianText,
                    english: englishText,
                    embedding: embedding,
                    timestamp: new Date().toISOString(),
                    verified: true
                };
                return [4 /*yield*/, client.index({
                        index: 'fijian-embeddings',
                        body: document
                    })];
            case 2:
                _a.sent();
                return [2 /*return*/, document];
        }
    });
}); };
var main = function (event) { return __awaiter(void 0, void 0, void 0, function () {
    var path, httpMethod, body, request, translation, request, client, storedDocument, error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 7, , 8]);
                path = event.path, httpMethod = event.httpMethod, body = event.body;
                if (!(path === '/translate' && httpMethod === 'POST')) return [3 /*break*/, 2];
                if (!body) {
                    return [2 /*return*/, {
                            statusCode: 400,
                            body: JSON.stringify({ error: 'Request body is required' })
                        }];
                }
                request = JSON.parse(body);
                if (!request.fijianText) {
                    return [2 /*return*/, {
                            statusCode: 400,
                            body: JSON.stringify({ error: 'fijianText is required' })
                        }];
                }
                return [4 /*yield*/, translateWithClaude(request.fijianText)];
            case 1:
                translation = _a.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify({
                            original: request.fijianText,
                            translation: translation,
                            message: "Review this translation and use /verify endpoint to submit verified version"
                        })
                    }];
            case 2:
                if (!(path === '/verify' && httpMethod === 'POST')) return [3 /*break*/, 6];
                if (!body) {
                    return [2 /*return*/, {
                            statusCode: 400,
                            body: JSON.stringify({ error: 'Request body is required' })
                        }];
                }
                request = JSON.parse(body);
                if (!request.originalFijian || !request.verifiedEnglish) {
                    return [2 /*return*/, {
                            statusCode: 400,
                            body: JSON.stringify({ error: 'Both originalFijian and verifiedEnglish are required' })
                        }];
                }
                return [4 /*yield*/, createOpenSearchClient()];
            case 3:
                client = _a.sent();
                return [4 /*yield*/, createIndexIfNotExists(client)];
            case 4:
                _a.sent();
                return [4 /*yield*/, storeVerifiedTranslation(client, request.originalFijian, request.verifiedEnglish)];
            case 5:
                storedDocument = _a.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify({
                            message: "Verified translation stored successfully",
                            document: storedDocument
                        })
                    }];
            case 6: return [2 /*return*/, {
                    statusCode: 404,
                    body: JSON.stringify({ error: 'Not Found' })
                }];
            case 7:
                error_2 = _a.sent();
                console.error('Error:', error_2);
                return [2 /*return*/, {
                        statusCode: 500,
                        body: JSON.stringify({
                            error: 'Internal Server Error',
                            detail: error_2 instanceof Error ? error_2.message : 'Unknown error'
                        })
                    }];
            case 8: return [2 /*return*/];
        }
    });
}); };
exports.main = main;
