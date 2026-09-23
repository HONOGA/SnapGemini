/**
 * SnapGemini - Gemini API Integration Module
 * Supports Streaming (SSE), Multimodal Vision, Auto-Fallback & Key Testing
 */

class GeminiService {
  constructor() {
    this.storageKey = 'snapgemini_api_key';
    this.modelKey = 'snapgemini_model';
    this.defaultModel = 'gemini-3.6-flash';
  }

  getApiKey() {
    return (localStorage.getItem(this.storageKey) || '').trim();
  }

  setApiKey(key) {
    localStorage.setItem(this.storageKey, key.trim());
  }

  getModel() {
    let model = localStorage.getItem(this.modelKey) || this.defaultModel;
    // 自動將過期的 1.5 與 2.0 模型無縫升級為最新的 3.6 Flash
    if (model === 'gemini-2.0-flash' || model === 'gemini-1.5-flash' || model === 'gemini-1.5-pro' || !model) {
      model = this.defaultModel;
      this.setModel(model);
    }
    return model;
  }

  setModel(model) {
    localStorage.setItem(this.modelKey, model);
  }

  hasApiKey() {
    const key = this.getApiKey();
    return Boolean(key && key.length > 10);
  }

  /**
   * 測試 API Key 連線可用性
   * @param {string} customKey - 可選自訂 Key
   * @param {string} customModel - 可選自訂模型
   */
  async testApiKey(customKey, customModel) {
    const key = (customKey || this.getApiKey() || '').trim();
    if (!key) {
      return { success: false, error: '請先輸入 API Key' };
    }
    const model = customModel || this.getModel();
    const startTime = performance.now();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
          generationConfig: { maxOutputTokens: 5 }
        })
      });

      const elapsed = Math.round(performance.now() - startTime);

      if (response.ok) {
        return { success: true, latency: elapsed, model };
      }

      const errorData = await response.json().catch(() => ({}));
      const message = errorData?.error?.message || `HTTP ${response.status}`;

      if (response.status === 400 && message.includes('API_KEY_INVALID')) {
        return { success: false, error: 'API Key 無效，請檢查前後是否有空格或缺漏字元', code: 400 };
      } else if (response.status === 429) {
        return { success: false, error: '免費配額已滿（429 Rate Limit），請稍候 1 分鐘再試', code: 429 };
      } else if (response.status === 503 || message.includes('high demand') || message.includes('temporarily')) {
        return { success: false, error: `Google 此模型伺服器目前尖峰繁忙（503），建議切換為 Gemini 2.5 Flash 或稍後重試`, code: 503 };
      } else {
        return { success: false, error: message, code: response.status };
      }
    } catch (err) {
      return { success: false, error: '網路連線失敗，請檢查手機 Wi-Fi 或行動網路' };
    }
  }

  /**
   * 根據選取模式返回專屬的 System Prompt / Instruction
   */
  getPromptForMode(mode, customPrompt = '') {
    const prompts = {
      identify: `請以「專家視角」詳細分析這張圖片：
1. **主要辨識**：明確指出圖中的主體是什麼（如生物品種、物品型號、地標建築、藝術品等）。
2. **關鍵特徵與細節**：描述肉眼可見的重點細節或狀態。
3. **延伸知識或實用資訊**：提供相關背景故事、使用建議、保養方式或注意事項。
請使用繁體中文，格式清晰美觀（善用粗體與條列式）。`,

      ocr: `請對這張圖片進行「高精確度 OCR 文字提取與整理」：
1. **完整提取文字**：將圖片中的所有文字完整摘錄出來（保留原有段落與層次）。
2. **核心重點摘要**：若內容較長，請在下方用 3~5 個條列點總結核心要點。
3. **表格/清單整理**：若圖中有表格或清單，請轉換為 Markdown 格式呈現。
請使用繁體中文輸出。`,

      translate: `請對這張圖片中的所有文字進行「翻譯成流暢繁體中文」：
1. **逐段/逐句對照**：將圖中外語文字翻譯為繁體中文（台灣習慣用語）。
2. **專業術語或文化背景補充**：若有特定專有名詞或俚語，請附帶簡短說明。
請排版整齊，方便閱讀。`,

      solve: `請以「資深解答專家」身份為圖中內容提供解答與分析：
1. **題目/問題辨識**：清楚說明圖片中的題目或遭遇的故障/錯誤狀態。
2. **逐步推導與解析**：提供詳細、清晰的步驟或排除方法。
3. **最終答案/結論**：以醒目的方式標出正確答案或推薦解決方案。
請使用繁體中文。`,

      nutrition: `請以「專業營養師與美食家」的角度分析圖中餐點/食物：
1. **菜品辨識**：列出圖中辨識出的所有料理與食材。
2. **預估熱量與三大營養素**：
   - 估計總熱量（大卡 kcal）
   - 碳水化合物、蛋白質、脂肪的大致比例或克數估算
3. **健康點評與建議**：針對這餐提出營養均衡建議或搭配提醒。
請使用繁體中文。`,

      custom: customPrompt.trim() ? customPrompt.trim() : '請詳細分析這張圖片，並以繁體中文回答。'
    };

    return prompts[mode] || prompts.identify;
  }

  /**
   * 呼叫 Gemini Vision API 串流分析圖片 (內建伺服器尖峰自動降級備用模型)
   * @param {string} base64Image - data:image/jpeg;base64,... 格式的圖片字串
   * @param {string} prompt - 要提問的文字
   * @param {function} onChunk - 收到串流 chunk 時的回呼函數 (text, fullText)
   * @param {Array} history - 追問時的歷史對話
   */
  async streamAnalyzeImage(base64Image, prompt, onChunk, history = []) {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('MISSING_API_KEY');
    }

    const selectedModel = this.getModel();
    // 備用降級順序，防止尖峰 503 卡住
    const fallbackList = [
      selectedModel,
      'gemini-2.5-flash',
      'gemini-3.0-flash',
      'gemini-3.7-flash'
    ].filter((m, idx, arr) => arr.indexOf(m) === idx);

    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const mimeType = base64Image.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';

    const contents = [];
    if (history && history.length > 0) {
      contents.push(...history);
    } else {
      contents.push({
        role: 'user',
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: cleanBase64 } }
        ]
      });
    }

    const requestBody = {
      contents: contents,
      generationConfig: {
        temperature: 0.4,
        topP: 0.95,
        maxOutputTokens: 2048,
      }
    };

    let lastError = null;

    for (let i = 0; i < fallbackList.length; i++) {
      const currentModel = fallbackList[i];
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:streamGenerateContent?alt=sse&key=${apiKey}`;

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          let errorData;
          try {
            errorData = await response.json();
          } catch (e) {
            errorData = { error: { message: response.statusText } };
          }
          const message = errorData?.error?.message || `HTTP ${response.status}`;

          // 若為 High demand (503) 且還有備用模型，嘗試下一個備用模型
          if ((response.status === 503 || message.includes('high demand') || response.status === 404 || message.includes('not found')) && i < fallbackList.length - 1) {
            console.warn(`模型 ${currentModel} 忙碌，自動切換至備用模型: ${fallbackList[i + 1]}`);
            if (window.uiController && window.uiController.showToast) {
              window.uiController.showToast(`伺服器尖峰，自動切換至備用模型 (${fallbackList[i + 1]})`, 'sparkles');
            }
            continue;
          }

          if (response.status === 400 && message.includes('API_KEY_INVALID')) {
            throw new Error('INVALID_API_KEY');
          } else if (response.status === 429) {
            throw new Error('QUOTA_EXCEEDED');
          } else if (response.status === 503 || message.includes('high demand')) {
            throw new Error('HIGH_DEMAND_ERROR: Google 伺服器目前尖峰繁忙，請稍候 10 秒後重試，或在設定切換為其他模型。');
          } else {
            throw new Error(`API_ERROR: ${message}`);
          }
        }

        // 讀取 SSE 串流
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let fullText = '';
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ')) {
              const jsonStr = trimmed.substring(6);
              if (jsonStr === '[DONE]') continue;

              try {
                const data = JSON.parse(jsonStr);
                const textChunk = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                if (textChunk) {
                  fullText += textChunk;
                  if (onChunk) onChunk(textChunk, fullText);
                }
              } catch (err) {
                console.warn('SSE 解析錯誤:', err, jsonStr);
              }
            }
          }
        }

        return fullText;

      } catch (err) {
        lastError = err;
        if (i < fallbackList.length - 1 && (err.message.includes('HIGH_DEMAND') || err.message.includes('fetch'))) {
          continue;
        }
        throw err;
      }
    }

    throw lastError || new Error('分析連線失敗，請重試');
  }

  /**
   * 針對同一張圖片進行追問
   */
  async streamFollowup(userQuestion, conversationHistory, onChunk) {
    const apiKey = this.getApiKey();
    if (!apiKey) throw new Error('MISSING_API_KEY');

    const model = this.getModel();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

    const newHistory = [
      ...conversationHistory,
      {
        role: 'user',
        parts: [{ text: userQuestion }]
      }
    ];

    const requestBody = {
      contents: newHistory,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData?.error?.message || `HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const jsonStr = trimmed.substring(6);
          try {
            const data = JSON.parse(jsonStr);
            const textChunk = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (textChunk) {
              fullText += textChunk;
              if (onChunk) onChunk(textChunk, fullText);
            }
          } catch (err) {}
        }
      }
    }

    return { fullText, updatedHistory: [...newHistory, { role: 'model', parts: [{ text: fullText }] }] };
  }
}

// 實例化並掛載到全域
window.geminiService = new GeminiService();
