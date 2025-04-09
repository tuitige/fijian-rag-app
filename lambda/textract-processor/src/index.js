"use strict";
// lambda/textract-processor/src/index.ts
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
exports.handler = void 0;
var client_textract_1 = require("@aws-sdk/client-textract");
var client_s3_1 = require("@aws-sdk/client-s3");
var client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
var lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
// Initialize clients
var textractClient = new client_textract_1.TextractClient({});
var s3Client = new client_s3_1.S3Client({});
var ddb = lib_dynamodb_1.DynamoDBDocument.from(new client_dynamodb_1.DynamoDB());
var handler = function (event) { return __awaiter(void 0, void 0, void 0, function () {
    var _i, _a, record, bucket, key, startResponse, jobId, jobComplete, getResult, blocks, processedContent, error_1;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 13, , 14]);
                _i = 0, _a = event.Records;
                _b.label = 1;
            case 1:
                if (!(_i < _a.length)) return [3 /*break*/, 12];
                record = _a[_i];
                bucket = record.s3.bucket.name;
                key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
                console.log("Processing new file upload: ".concat(key, " in bucket: ").concat(bucket));
                return [4 /*yield*/, textractClient.send(new client_textract_1.StartDocumentTextDetectionCommand({
                        DocumentLocation: {
                            S3Object: {
                                Bucket: bucket,
                                Name: key
                            }
                        }
                    }))];
            case 2:
                startResponse = _b.sent();
                jobId = startResponse.JobId;
                if (!jobId) {
                    throw new Error('Failed to start Textract job');
                }
                jobComplete = false;
                _b.label = 3;
            case 3:
                if (!!jobComplete) return [3 /*break*/, 11];
                return [4 /*yield*/, textractClient.send(new client_textract_1.GetDocumentTextDetectionCommand({
                        JobId: jobId
                    }))];
            case 4:
                getResult = _b.sent();
                if (!(getResult.JobStatus === 'SUCCEEDED')) return [3 /*break*/, 7];
                jobComplete = true;
                blocks = getResult.Blocks || [];
                return [4 /*yield*/, processTextractBlocks(blocks)];
            case 5:
                processedContent = _b.sent();
                // Store the processed content
                return [4 /*yield*/, storeProcessedContent(processedContent)];
            case 6:
                // Store the processed content
                _b.sent();
                return [3 /*break*/, 10];
            case 7:
                if (!(getResult.JobStatus === 'FAILED')) return [3 /*break*/, 8];
                throw new Error("Textract job failed for document ".concat(key));
            case 8: 
            // Wait before polling again
            return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 1000); })];
            case 9:
                // Wait before polling again
                _b.sent();
                _b.label = 10;
            case 10: return [3 /*break*/, 3];
            case 11:
                _i++;
                return [3 /*break*/, 1];
            case 12: return [2 /*return*/, {
                    statusCode: 200,
                    body: JSON.stringify({ message: 'Processing complete' })
                }];
            case 13:
                error_1 = _b.sent();
                console.error('Error processing document:', error_1);
                throw error_1;
            case 14: return [2 /*return*/];
        }
    });
}); };
exports.handler = handler;
function processTextractBlocks(blocks) {
    return __awaiter(this, void 0, void 0, function () {
        var text;
        return __generator(this, function (_a) {
            text = blocks
                .filter(function (block) { return block.BlockType === 'LINE'; })
                .map(function (block) { return block.Text; })
                .join('\n');
            // TODO: Implement logic to structure the content
            // This is a placeholder implementation
            return [2 /*return*/, {
                    moduleId: "module_".concat(Date.now()),
                    title: 'Untitled Module',
                    content: [{
                            type: 'vocabulary',
                            items: [{
                                    term: 'Example Term',
                                    definition: 'Example Definition'
                                }]
                        }]
                }];
        });
    });
}
function storeProcessedContent(content) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ddb.put({
                        TableName: process.env.MODULES_TABLE_NAME || 'FijianModules',
                        Item: __assign(__assign({}, content), { createdAt: new Date().toISOString(), status: 'PROCESSED' })
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
