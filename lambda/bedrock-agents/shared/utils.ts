// lambda/bedrock-agents/src/shared/utils.ts

export const decodeBedrockResponse = (body: Uint8Array): any => {
    const text = new TextDecoder().decode(body);
    try {
      return JSON.parse(text);
    } catch (err) {
      console.error('❌ Failed to parse Bedrock response:', text);
      throw err;
    }
  };

  export const parseClaudeResponse = (raw: string) => {
    try {
      const parsed = JSON.parse(raw);
  
      if (!parsed || !parsed.content || !Array.isArray(parsed.content)) {
        console.warn("⚠️ Claude response missing 'content' array:", parsed);
        return { translatedText: "No content returned." };
      }
  
      const textBlock = parsed.content.find(c => c.type === 'text');
      if (!textBlock || !textBlock.text) {
        console.warn("⚠️ Claude content array missing valid text entry:", parsed.content);
        return { translatedText: "No text content returned." };
      }
  
      const text = textBlock.text.trim();
  
      let json: any;
      try {
        json = JSON.parse(text);
      } catch (e) {
        console.warn("⚠️ Unable to parse Claude text content as JSON:", text);
        return { translatedText: text }; // fallback to plain string
      }
  
      const requiredFields = [
        "originalText", "translatedText", "sourceLanguage",
        "translatedLanguage", "confidence", "notes"
      ];
  
      const hasAll = requiredFields.every(field => field in json);
      if (!hasAll) {
        console.warn("⚠️ Missing required fields in parsed JSON:", json);
      }
  
      console.log("✅ Parsed Claude response object:", json);
      return json;
  
    } catch (err) {
      console.error("❌ Failed to parse Claude response:", err);
      return { translatedText: "Error parsing Claude response." };
    }
  };
  