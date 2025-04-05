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
var opensearch_1 = require("@opensearch-project/opensearch");
var credential_provider_node_1 = require("@aws-sdk/credential-provider-node");
var aws_1 = require("@opensearch-project/opensearch/aws");
var client_bedrock_runtime_1 = require("@aws-sdk/client-bedrock-runtime");
// Updated constants for provisioned cluster
var OPENSEARCH_DOMAIN_ENDPOINT = process.env.OPENSEARCH_DOMAIN_ENDPOINT || '';
var INDEX_NAME = process.env.INDEX_NAME || 'translations';
// Modified client creation for provisioned cluster
var createOpenSearchClient = function () {
    if (!OPENSEARCH_DOMAIN_ENDPOINT) {
        throw new Error('OPENSEARCH_DOMAIN_ENDPOINT environment variable is required');
    }
    return new opensearch_1.Client(__assign(__assign({}, (0, aws_1.AwsSigv4Signer)({
        region: process.env.AWS_REGION || 'us-west-2',
        service: 'es', // Changed from 'aoss' to 'es' for provisioned cluster
        getCredentials: (0, credential_provider_node_1.defaultProvider)()
    })), { node: "https://".concat(OPENSEARCH_DOMAIN_ENDPOINT), ssl: {
            rejectUnauthorized: true
        } }));
};
// Modified index creation with health check
var createIndexIfNotExists = function (client) { return __awaiter(void 0, void 0, void 0, function () {
    var health, exists, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 5, , 6]);
                return [4 /*yield*/, client.cluster.health({})];
            case 1:
                health = _a.sent();
                if (health.body.status === 'red') {
                    throw new Error('Cluster health is red, operations not permitted');
                }
                return [4 /*yield*/, client.indices.exists({
                        index: INDEX_NAME
                    })];
            case 2:
                exists = _a.sent();
                if (!!exists.body) return [3 /*break*/, 4];
                return [4 /*yield*/, client.indices.create({
                        index: INDEX_NAME,
                        body: {
                            settings: {
                                number_of_shards: 1,
                                number_of_replicas: 1
                            },
                            mappings: {
                                properties: {
                                    fijian: { type: 'text' },
                                    english: { type: 'text' },
                                    timestamp: { type: 'date' }
                                }
                            }
                        }
                    })];
            case 3:
                _a.sent();
                _a.label = 4;
            case 4: return [3 /*break*/, 6];
            case 5:
                error_1 = _a.sent();
                console.error('Error creating index:', error_1);
                throw error_1;
            case 6: return [2 /*return*/];
        }
    });
}); };
// Modified verify handler with enhanced error handling
var handleVerify = function (client, body, headers) { return __awaiter(void 0, void 0, void 0, function () {
    var originalFijian, verifiedEnglish, health, document_1, response, error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                originalFijian = body.originalFijian, verifiedEnglish = body.verifiedEnglish;
                if (!originalFijian || !verifiedEnglish) {
                    return [2 /*return*/, {
                            statusCode: 400,
                            headers: headers,
                            body: JSON.stringify({ message: 'originalFijian and verifiedEnglish are required' })
                        }];
                }
                _a.label = 1;
            case 1:
                _a.trys.push([1, 4, , 5]);
                return [4 /*yield*/, client.cluster.health({})];
            case 2:
                health = _a.sent();
                if (health.body.status === 'red') {
                    throw new Error('Cluster is not healthy');
                }
                document_1 = {
                    fijian: originalFijian,
                    english: verifiedEnglish,
                    timestamp: new Date().toISOString()
                };
                return [4 /*yield*/, client.index({
                        index: INDEX_NAME,
                        body: document_1,
                        refresh: true // Ensure immediate searchability
                    })];
            case 3:
                response = _a.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        headers: headers,
                        body: JSON.stringify({
                            message: 'Translation verified and stored successfully',
                            id: response.body._id,
                            clusterHealth: health.body.status
                        })
                    }];
            case 4:
                error_2 = _a.sent();
                console.error('Verification error:', error_2);
                // Enhanced error handling
                if (error_2.name === 'ConnectionError') {
                    return [2 /*return*/, {
                            statusCode: 503,
                            headers: headers,
                            body: JSON.stringify({
                                message: 'OpenSearch cluster is not available',
                                error: 'The cluster might be stopped or starting up'
                            })
                        }];
                }
                if (error_2.message.includes('Cluster is not healthy')) {
                    return [2 /*return*/, {
                            statusCode: 503,
                            headers: headers,
                            body: JSON.stringify({
                                message: 'OpenSearch cluster is not healthy',
                                error: 'Please try again later'
                            })
                        }];
                }
                return [2 /*return*/, {
                        statusCode: 500,
                        headers: headers,
                        body: JSON.stringify({
                            message: 'Error storing verified translation',
                            error: error_2.message
                        })
                    }];
            case 5: return [2 /*return*/];
        }
    });
}); };
// Your existing handleTranslate function remains unchanged
var handleTranslate = function (body, headers) { return __awaiter(void 0, void 0, void 0, function () {
    var fijianText, bedrockClient, prompt_1, command, response, responseBody, claudeResponse, parsedResponse, jsonMatch, jsonStr, error_3;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                fijianText = body.fijianText;
                if (!fijianText) {
                    return [2 /*return*/, {
                            statusCode: 400,
                            headers: headers,
                            body: JSON.stringify({ error: "fijianText is required in request body" })
                        }];
                }
                bedrockClient = new client_bedrock_runtime_1.BedrockRuntimeClient({ region: "us-west-2" });
                prompt_1 = {
                    anthropic_version: "bedrock-2023-05-31",
                    max_tokens: 1024,
                    messages: [
                        {
                            role: "user",
                            content: [
                                {
                                    type: "text",
                                    text: "Please translate the following Fijian text to English. Provide your response in JSON format with these keys:\n              - translation: Your direct English translation\n              - confidence: \"high\", \"medium\", or \"low\"\n              - notes: Any disclaimers, uncertainties, or additional context about the translation\n              \n              Fijian text: \"".concat(fijianText, "\"")
                                }
                            ]
                        }
                    ]
                };
                command = new client_bedrock_runtime_1.InvokeModelCommand({
                    modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
                    contentType: "application/json",
                    accept: "application/json",
                    body: JSON.stringify(prompt_1)
                });
                return [4 /*yield*/, bedrockClient.send(command)];
            case 1:
                response = _a.sent();
                responseBody = JSON.parse(new TextDecoder().decode(response.body));
                claudeResponse = responseBody.content[0].text;
                parsedResponse = void 0;
                try {
                    jsonMatch = claudeResponse.match(/```json[\r\n]?([\s\S]*?)[\r\n]?```/) ||
                        claudeResponse.match(/{[\s\S]*}/);
                    jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : claudeResponse;
                    parsedResponse = JSON.parse(jsonStr.trim());
                }
                catch (parseError) {
                    console.error('Error parsing Claude response:', parseError);
                    parsedResponse = {
                        translation: claudeResponse,
                        confidence: "unknown",
                        notes: "Error parsing structured response"
                    };
                }
                return [2 /*return*/, {
                        statusCode: 200,
                        headers: headers,
                        body: JSON.stringify({
                            originalText: fijianText,
                            translation: parsedResponse.translation,
                            confidence: parsedResponse.confidence,
                            notes: parsedResponse.notes,
                            rawResponse: claudeResponse // Optional: include for debugging
                        })
                    }];
            case 2:
                error_3 = _a.sent();
                console.error('Error:', error_3);
                return [2 /*return*/, {
                        statusCode: 500,
                        headers: headers,
                        body: JSON.stringify({
                            error: "Error translating text",
                            details: error_3.message
                        })
                    }];
            case 3: return [2 /*return*/];
        }
    });
}); };
// Modified main handler with client reuse
var opensearchClient = null;
var main = function (event) { return __awaiter(void 0, void 0, void 0, function () {
    var headers, path, body, _a, error_4;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                headers = {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'OPTIONS,POST'
                };
                _b.label = 1;
            case 1:
                _b.trys.push([1, 10, , 11]);
                if (event.httpMethod === 'OPTIONS') {
                    return [2 /*return*/, { statusCode: 200, headers: headers, body: '' }];
                }
                if (!!opensearchClient) return [3 /*break*/, 3];
                opensearchClient = createOpenSearchClient();
                return [4 /*yield*/, createIndexIfNotExists(opensearchClient)];
            case 2:
                _b.sent();
                _b.label = 3;
            case 3:
                path = event.path;
                body = JSON.parse(event.body || '{}');
                _a = path;
                switch (_a) {
                    case '/translate': return [3 /*break*/, 4];
                    case '/verify': return [3 /*break*/, 6];
                }
                return [3 /*break*/, 8];
            case 4: return [4 /*yield*/, handleTranslate(body, headers)];
            case 5: return [2 /*return*/, _b.sent()];
            case 6: return [4 /*yield*/, handleVerify(opensearchClient, body, headers)];
            case 7: return [2 /*return*/, _b.sent()];
            case 8: return [2 /*return*/, {
                    statusCode: 404,
                    headers: headers,
                    body: JSON.stringify({ message: 'Not Found' })
                }];
            case 9: return [3 /*break*/, 11];
            case 10:
                error_4 = _b.sent();
                console.error('Error:', error_4);
                return [2 /*return*/, {
                        statusCode: 500,
                        headers: headers,
                        body: JSON.stringify({
                            message: 'Internal Server Error',
                            error: error_4.message
                        })
                    }];
            case 11: return [2 /*return*/];
        }
    });
}); };
exports.main = main;
