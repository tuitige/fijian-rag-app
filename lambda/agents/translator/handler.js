"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const agent_1 = require("./agent");
const handler = async (event) => {
    try {
        const request = JSON.parse(event.body || '{}');
        // Validate request
        if (!request.sourceText || !request.sourceLanguage || !request.targetLanguage) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    error: 'Missing required fields: sourceText, sourceLanguage, targetLanguage'
                })
            };
        }
        console.log('Translation request:', request);
        const agent = new agent_1.TranslatorAgent();
        const result = await agent.translate(request);
        return {
            statusCode: 200,
            body: JSON.stringify(result)
        };
    }
    catch (error) {
        console.error('Translation error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error'
            })
        };
    }
};
exports.handler = handler;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGFuZGxlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImhhbmRsZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBRUEsbUNBQTBDO0FBR25DLE1BQU0sT0FBTyxHQUFHLEtBQUssRUFDMUIsS0FBMkIsRUFDSyxFQUFFO0lBQ2xDLElBQUksQ0FBQztRQUNILE1BQU0sT0FBTyxHQUF1QixJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxJQUFJLElBQUksSUFBSSxDQUFDLENBQUM7UUFFbkUsbUJBQW1CO1FBQ25CLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxJQUFJLENBQUMsT0FBTyxDQUFDLGNBQWMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUM5RSxPQUFPO2dCQUNMLFVBQVUsRUFBRSxHQUFHO2dCQUNmLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDO29CQUNuQixLQUFLLEVBQUUscUVBQXFFO2lCQUM3RSxDQUFDO2FBQ0gsQ0FBQztRQUNKLENBQUM7UUFFRCxPQUFPLENBQUMsR0FBRyxDQUFDLHNCQUFzQixFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBRTdDLE1BQU0sS0FBSyxHQUFHLElBQUksdUJBQWUsRUFBRSxDQUFDO1FBQ3BDLE1BQU0sTUFBTSxHQUFHLE1BQU0sS0FBSyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUU5QyxPQUFPO1lBQ0wsVUFBVSxFQUFFLEdBQUc7WUFDZixJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUM7U0FDN0IsQ0FBQztJQUNKLENBQUM7SUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1FBQ2YsT0FBTyxDQUFDLEtBQUssQ0FBQyxvQkFBb0IsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUMzQyxPQUFPO1lBQ0wsVUFBVSxFQUFFLEdBQUc7WUFDZixJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQztnQkFDbkIsS0FBSyxFQUFFLHVCQUF1QjtnQkFDOUIsT0FBTyxFQUFFLEtBQUssWUFBWSxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLGVBQWU7YUFDbEUsQ0FBQztTQUNILENBQUM7SUFDSixDQUFDO0FBQ0gsQ0FBQyxDQUFDO0FBbkNXLFFBQUEsT0FBTyxXQW1DbEIiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBsYW1iZGEvYWdlbnRzL3RyYW5zbGF0b3IvaGFuZGxlci50c1xyXG5pbXBvcnQgeyBBUElHYXRld2F5UHJveHlFdmVudCwgQVBJR2F0ZXdheVByb3h5UmVzdWx0IH0gZnJvbSAnYXdzLWxhbWJkYSc7XHJcbmltcG9ydCB7IFRyYW5zbGF0b3JBZ2VudCB9IGZyb20gJy4vYWdlbnQnO1xyXG5pbXBvcnQgeyBUcmFuc2xhdGlvblJlcXVlc3QgfSBmcm9tICcuLi8uLi9zaGFyZWQvdHlwZXMvZG9jdW1lbnRzJztcclxuXHJcbmV4cG9ydCBjb25zdCBoYW5kbGVyID0gYXN5bmMgKFxyXG4gIGV2ZW50OiBBUElHYXRld2F5UHJveHlFdmVudFxyXG4pOiBQcm9taXNlPEFQSUdhdGV3YXlQcm94eVJlc3VsdD4gPT4ge1xyXG4gIHRyeSB7XHJcbiAgICBjb25zdCByZXF1ZXN0OiBUcmFuc2xhdGlvblJlcXVlc3QgPSBKU09OLnBhcnNlKGV2ZW50LmJvZHkgfHwgJ3t9Jyk7XHJcbiAgICBcclxuICAgIC8vIFZhbGlkYXRlIHJlcXVlc3RcclxuICAgIGlmICghcmVxdWVzdC5zb3VyY2VUZXh0IHx8ICFyZXF1ZXN0LnNvdXJjZUxhbmd1YWdlIHx8ICFyZXF1ZXN0LnRhcmdldExhbmd1YWdlKSB7XHJcbiAgICAgIHJldHVybiB7XHJcbiAgICAgICAgc3RhdHVzQ29kZTogNDAwLFxyXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcclxuICAgICAgICAgIGVycm9yOiAnTWlzc2luZyByZXF1aXJlZCBmaWVsZHM6IHNvdXJjZVRleHQsIHNvdXJjZUxhbmd1YWdlLCB0YXJnZXRMYW5ndWFnZSdcclxuICAgICAgICB9KVxyXG4gICAgICB9O1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnNvbGUubG9nKCdUcmFuc2xhdGlvbiByZXF1ZXN0OicsIHJlcXVlc3QpO1xyXG5cclxuICAgIGNvbnN0IGFnZW50ID0gbmV3IFRyYW5zbGF0b3JBZ2VudCgpO1xyXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYWdlbnQudHJhbnNsYXRlKHJlcXVlc3QpO1xyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgIHN0YXR1c0NvZGU6IDIwMCxcclxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkocmVzdWx0KVxyXG4gICAgfTtcclxuICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgY29uc29sZS5lcnJvcignVHJhbnNsYXRpb24gZXJyb3I6JywgZXJyb3IpO1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgc3RhdHVzQ29kZTogNTAwLFxyXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XHJcbiAgICAgICAgZXJyb3I6ICdJbnRlcm5hbCBzZXJ2ZXIgZXJyb3InLFxyXG4gICAgICAgIG1lc3NhZ2U6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogJ1Vua25vd24gZXJyb3InXHJcbiAgICAgIH0pXHJcbiAgICB9O1xyXG4gIH1cclxufTtcclxuIl19