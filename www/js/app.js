/**
 * SnapGemini - Master Application Controller
 * Camera Management, Snap & Analyze Flow, Mode Handling, History & Settings
 */

class SnapGeminiApp {
  constructor() {
    this.videoElement = document.getElementById('camera-feed');
    this.canvasElement = document.getElementById('capture-canvas');
    this.currentStream = null;
    this.facingMode = 'environment'; // 預設後置主鏡頭
    this.currentTrack = null;
    this.isTorchOn = false;

    this.currentMode = 'identify';
    this.lastCapturedImage = null;
    this.currentAnalysisText = '';
    this.conversationHistory = [];

    this.historyKey = 'snapgemini_history_v1';
    this.init();
  }

  async init() {
    this.setupEventListeners();
    this.updateModelDisplay();
    this.loadSettings();

    // 第一次啟動時，若無 API Key，顯示溫馨設定彈窗
    if (!window.geminiService.hasApiKey()) {
      setTimeout(() => {
        this.openSettings(true);
      }, 500);
    }

    // 啟動相機
    await this.startCamera();
  }

  /**
   * 綁定介面所有事件
   */
  setupEventListeners() {
    // 快門拍照
    const shutterBtn = document.getElementById('btn-shutter');
    if (shutterBtn) {
      shutterBtn.addEventListener('click', () => this.handleSnap());
    }

    // 模式切換按鈕群
    const modePills = document.querySelectorAll('.mode-pill');
    modePills.forEach(pill => {
      pill.addEventListener('click', (e) => {
        const mode = pill.getAttribute('data-mode');
        this.switchMode(mode, pill);
      });
    });

    // 鏡頭反轉
    const flipBtn = document.getElementById('btn-flip');
    if (flipBtn) {
      flipBtn.addEventListener('click', () => this.toggleCameraFacing());
    }

    // 閃光燈/手電筒
    const flashBtn = document.getElementById('btn-flash');
    if (flashBtn) {
      flashBtn.addEventListener('click', () => this.toggleFlashlight());
    }

    // 相簿檔案選取
    const fileInput = document.getElementById('file-input');
    const fallbackInput = document.getElementById('fallback-file-input');
    [fileInput, fallbackInput].forEach(input => {
      if (input) {
        input.addEventListener('change', (e) => this.handleFileUpload(e));
      }
    });

    // 重試相機按鈕
    const retryCamBtn = document.getElementById('btn-retry-camera');
    if (retryCamBtn) {
      retryCamBtn.addEventListener('click', () => this.startCamera());
    }

    // 底部抽屜關閉 & 遮罩點擊
    const closeSheetBtn = document.getElementById('btn-close-sheet');
    const sheetScrim = document.getElementById('sheet-scrim');
    if (closeSheetBtn) closeSheetBtn.addEventListener('click', () => window.uiController.closeResultSheet());
    if (sheetScrim) sheetScrim.addEventListener('click', () => window.uiController.closeResultSheet());

    // 朗讀與複製按鈕
    const ttsBtn = document.getElementById('btn-tts');
    const copyBtn = document.getElementById('btn-copy');
    if (ttsBtn) {
      ttsBtn.addEventListener('click', () => {
        window.uiController.toggleTTS(this.currentAnalysisText);
      });
    }
    if (copyBtn) {
      copyBtn.addEventListener('click', () => this.copyAnalysisResult());
    }

    // 追問送出
    const followupSendBtn = document.getElementById('btn-followup-send');
    const followupInput = document.getElementById('followup-input');
    if (followupSendBtn && followupInput) {
      const sendFollowup = () => this.handleFollowup();
      followupSendBtn.addEventListener('click', sendFollowup);
      followupInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendFollowup();
      });
    }

    // 自訂提問切換
    const toggleCustomBtn = document.getElementById('btn-toggle-custom');
    if (toggleCustomBtn) {
      toggleCustomBtn.addEventListener('click', () => {
        const customPill = document.querySelector('.mode-pill[data-mode="custom"]');
        if (customPill) this.switchMode('custom', customPill);
        const input = document.getElementById('custom-prompt-input');
        if (input) input.focus();
      });
    }

    // 語音輸入自訂問題 (Web Speech Recognition)
    const voiceInputBtn = document.getElementById('btn-voice-input');
    if (voiceInputBtn) {
      voiceInputBtn.addEventListener('click', () => this.startVoiceRecognition());
    }

    // 設定彈窗開啟/關閉/儲存
    const settingsBtn = document.getElementById('btn-settings');
    const closeSettingsBtn = document.getElementById('btn-close-settings');
    const saveSettingsBtn = document.getElementById('btn-save-settings');
    const toggleKeyVisBtn = document.getElementById('btn-toggle-key-vis');

    if (settingsBtn) settingsBtn.addEventListener('click', () => this.openSettings());
    if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', () => this.closeSettings());
    if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', () => this.saveSettings());
    if (toggleKeyVisBtn) {
      toggleKeyVisBtn.addEventListener('click', () => {
        const keyInput = document.getElementById('input-api-key');
        if (keyInput) {
          keyInput.type = keyInput.type === 'password' ? 'text' : 'password';
        }
      });
    }

    // 歷史紀錄彈窗
    const historyBtn = document.getElementById('btn-history');
    const closeHistoryBtn = document.getElementById('btn-close-history');
    const clearHistoryBtn = document.getElementById('btn-clear-history');

    if (historyBtn) historyBtn.addEventListener('click', () => this.openHistory());
    if (closeHistoryBtn) closeHistoryBtn.addEventListener('click', () => this.closeHistory());
    if (clearHistoryBtn) clearHistoryBtn.addEventListener('click', () => this.clearHistory());
  }

  /**
   * 啟動攝影機
   */
  async startCamera() {
    const loadingOverlay = document.getElementById('camera-loading');
    const errorOverlay = document.getElementById('camera-error');
    if (loadingOverlay) loadingOverlay.style.display = 'flex';
    if (errorOverlay) errorOverlay.style.display = 'none';

    // 停止先前的 stream
    if (this.currentStream) {
      this.currentStream.getTracks().forEach(track => track.stop());
    }

    try {
      const constraints = {
        video: {
          facingMode: { ideal: this.facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.currentStream = stream;
      this.videoElement.srcObject = stream;
      this.currentTrack = stream.getVideoTracks()[0];

      // 檢查閃光燈 (Torch) 支援性
      const capabilities = this.currentTrack?.getCapabilities?.() || {};
      const flashBtn = document.getElementById('btn-flash');
      if (flashBtn) {
        flashBtn.style.display = capabilities.torch ? 'flex' : 'none';
      }

      this.videoElement.onloadedmetadata = () => {
        if (loadingOverlay) loadingOverlay.style.display = 'none';
        this.videoElement.play();
      };

    } catch (err) {
      console.error('相機存取失敗:', err);
      if (loadingOverlay) loadingOverlay.style.display = 'none';
      if (errorOverlay) {
        errorOverlay.style.display = 'flex';
        const msg = document.getElementById('camera-error-msg');
        if (msg) {
          msg.textContent = err.name === 'NotAllowedError' 
            ? '請在手機瀏覽器網址列旁點擊「鎖定/權限」設定，允許存取相機。'
            : '無法啟動相機，請嘗試使用相簿選取照片。';
        }
      }
    }
  }

  /**
   * 切換前後鏡頭
   */
  async toggleCameraFacing() {
    this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
    const flipBtn = document.getElementById('btn-flip');
    if (flipBtn) {
      flipBtn.style.transform = 'rotate(180deg)';
      setTimeout(() => flipBtn.style.transform = '', 300);
    }
    await this.startCamera();
  }

  /**
   * 開關閃光燈
   */
  async toggleFlashlight() {
    if (!this.currentTrack || !this.currentTrack.applyConstraints) return;
    try {
      this.isTorchOn = !this.isTorchOn;
      await this.currentTrack.applyConstraints({
        advanced: [{ torch: this.isTorchOn }]
      });
      const flashIcon = document.getElementById('icon-flash');
      const flashBtn = document.getElementById('btn-flash');
      if (flashBtn) flashBtn.classList.toggle('active', this.isTorchOn);
      if (flashIcon) {
        flashIcon.setAttribute('data-lucide', this.isTorchOn ? 'zap' : 'zap-off');
        if (window.lucide) lucide.createIcons();
      }
    } catch (e) {
      console.warn('閃光燈控制不支援:', e);
    }
  }

  /**
   * 切換辨識模式
   */
  switchMode(mode, pillElement) {
    this.currentMode = mode;
    document.querySelectorAll('.mode-pill').forEach(p => p.classList.remove('active'));
    if (pillElement) {
      pillElement.classList.add('active');
      pillElement.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }

    const customContainer = document.getElementById('custom-prompt-container');
    if (customContainer) {
      customContainer.style.display = mode === 'custom' ? 'flex' : 'none';
    }
  }

  /**
   * 一鍵快門拍照並發送分析
   */
  async handleSnap() {
    // 檢查 API Key
    if (!window.geminiService.hasApiKey()) {
      window.uiController.showToast('請先設定 Gemini API Key', 'key');
      this.openSettings(true);
      return;
    }

    // 快門反饋聲與震動
    window.uiController.playShutterSound();

    const shutterBtn = document.getElementById('btn-shutter');
    if (shutterBtn) shutterBtn.classList.add('capturing');

    try {
      // 截取當前鏡頭畫面並壓縮
      const base64Image = this.captureFrameFromVideo();
      this.lastCapturedImage = base64Image;

      // 準備分析
      await this.performAnalysis(base64Image);
    } catch (err) {
      console.error('拍照處理失敗:', err);
      window.uiController.showAnalysisError('CAPTURE_FAILED', err.message);
    } finally {
      if (shutterBtn) shutterBtn.classList.remove('capturing');
    }
  }

  /**
   * 從相簿選取照片處理
   */
  async handleFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!window.geminiService.hasApiKey()) {
      window.uiController.showToast('請先設定 Gemini API Key', 'key');
      this.openSettings(true);
      return;
    }

    window.uiController.playShutterSound();

    const reader = new FileReader();
    reader.onload = async (e) => {
      const rawBase64 = e.target.result;
      const resizedBase64 = await this.resizeBase64Image(rawBase64);
      this.lastCapturedImage = resizedBase64;
      await this.performAnalysis(resizedBase64);
    };
    reader.readAsDataURL(file);
    // 重設 input 讓同張圖也能再選
    event.target.value = '';
  }

  /**
   * 從 Video 擷取一幀畫布並做最適壓縮
   */
  captureFrameFromVideo() {
    const video = this.videoElement;
    const canvas = this.canvasElement;
    const maxDimension = parseInt(localStorage.getItem('snapgemini_img_quality') || '1280', 10);

    let width = video.videoWidth || 1280;
    let height = video.videoHeight || 720;

    // 等比例縮放
    if (width > maxDimension || height > maxDimension) {
      if (width > height) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // 若為前置鏡頭，需水平翻轉以符合鏡像預期
    if (this.facingMode === 'user') {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.85);
  }

  /**
   * 壓縮上傳的照片
   */
  resizeBase64Image(base64Str) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = parseInt(localStorage.getItem('snapgemini_img_quality') || '1280', 10);
        let { width, height } = img;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = base64Str;
    });
  }

  /**
   * 核心分析執行函式 (串流連線 Gemini API)
   */
  async performAnalysis(base64Image) {
    const modeNames = {
      identify: '萬物解讀',
      ocr: '文字提取',
      translate: '翻成繁中',
      solve: '解題解答',
      nutrition: '飲食熱量',
      custom: '自訂提問'
    };
    const modeName = modeNames[this.currentMode] || 'AI 分析';

    // 打開結果抽屜
    window.uiController.openResultSheet(base64Image, modeName);

    // 取得客製化 Prompt
    const customInput = document.getElementById('custom-prompt-input')?.value || '';
    const prompt = window.geminiService.getPromptForMode(this.currentMode, customInput);

    this.currentAnalysisText = '';
    this.conversationHistory = [];

    try {
      const fullMarkdown = await window.geminiService.streamAnalyzeImage(
        base64Image,
        prompt,
        (chunk, currentFullText) => {
          this.currentAnalysisText = currentFullText;
          window.uiController.updateAnalysisMarkdown(currentFullText);
        }
      );

      this.currentAnalysisText = fullMarkdown;
      window.uiController.finishAnalysis(fullMarkdown);

      // 建立初始對話歷史紀錄供後續追問
      const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');
      const mimeType = base64Image.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';
      this.conversationHistory = [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: cleanBase64 } }
          ]
        },
        {
          role: 'model',
          parts: [{ text: fullMarkdown }]
        }
      ];

      // 儲存至歷史紀錄
      this.saveToHistory(base64Image, modeName, fullMarkdown);

    } catch (err) {
      console.error('Gemini 分析失敗:', err);
      window.uiController.showAnalysisError(err.message);
    }
  }

  /**
   * 追問處理
   */
  async handleFollowup() {
    const input = document.getElementById('followup-input');
    const question = input?.value?.trim();
    if (!question) return;

    input.value = '';
    const output = document.getElementById('analysis-output');
    
    // 在輸出區下方加上使用者的追問
    const userBlock = document.createElement('div');
    userBlock.style.marginTop = '18px';
    userBlock.style.padding = '10px 14px';
    userBlock.style.background = 'rgba(59, 130, 246, 0.15)';
    userBlock.style.borderRadius = '12px';
    userBlock.style.border = '1px solid rgba(59, 130, 246, 0.3)';
    userBlock.innerHTML = `<strong>🙋 追問：</strong> ${question}`;
    output.appendChild(userBlock);

    const answerBlock = document.createElement('div');
    answerBlock.style.marginTop = '10px';
    answerBlock.innerHTML = '<span style="color: #94a3b8;">思考中...</span>';
    output.appendChild(answerBlock);

    try {
      const result = await window.geminiService.streamFollowup(
        question,
        this.conversationHistory,
        (chunk, full) => {
          answerBlock.innerHTML = marked.parse(full);
        }
      );
      this.conversationHistory = result.updatedHistory;
    } catch (err) {
      answerBlock.innerHTML = `<span style="color: #f87171;">❌ 追問失敗：${err.message}</span>`;
    }
  }

  /**
   * 複製分析文字
   */
  async copyAnalysisResult() {
    if (!this.currentAnalysisText) return;
    try {
      await navigator.clipboard.writeText(this.currentAnalysisText);
      window.uiController.showToast('已複製分析內容至剪貼簿', 'check');
    } catch (err) {
      window.uiController.showToast('複製失敗，請手動選取', 'copy');
    }
  }

  /**
   * 語音識別 (Web Speech Recognition)
   */
  startVoiceRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      window.uiController.showToast('此瀏覽器不支援語音輸入', 'mic-off');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-TW';
    recognition.interimResults = false;

    window.uiController.showToast('請開始說話...', 'mic');
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      const input = document.getElementById('custom-prompt-input');
      if (input) {
        input.value = transcript;
        window.uiController.showToast('語音辨識完成', 'check');
      }
    };
    recognition.onerror = () => {
      window.uiController.showToast('語音辨識結束或未取得聲音', 'mic-off');
    };
    recognition.start();
  }

  /**
   * 設定彈窗控制
   */
  openSettings(isFirstTime = false) {
    const modal = document.getElementById('settings-modal');
    const keyInput = document.getElementById('input-api-key');
    const modelSelect = document.getElementById('select-model');
    const qualitySelect = document.getElementById('select-image-quality');
    const hapticsCheck = document.getElementById('check-haptics');
    const autoTtsCheck = document.getElementById('check-auto-tts');

    if (keyInput) keyInput.value = window.geminiService.getApiKey();
    if (modelSelect) modelSelect.value = window.geminiService.getModel();
    if (qualitySelect) qualitySelect.value = localStorage.getItem('snapgemini_img_quality') || '1280';
    if (hapticsCheck) hapticsCheck.checked = localStorage.getItem('snapgemini_haptics') !== 'false';
    if (autoTtsCheck) autoTtsCheck.checked = localStorage.getItem('snapgemini_auto_tts') === 'true';

    if (modal) modal.style.display = 'flex';
  }

  closeSettings() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.style.display = 'none';
  }

  saveSettings() {
    const keyInput = document.getElementById('input-api-key');
    const modelSelect = document.getElementById('select-model');
    const qualitySelect = document.getElementById('select-image-quality');
    const hapticsCheck = document.getElementById('check-haptics');
    const autoTtsCheck = document.getElementById('check-auto-tts');

    const key = keyInput?.value?.trim();
    if (!key) {
      window.uiController.showToast('請輸入有效的 API Key', 'alert-circle');
      return;
    }

    window.geminiService.setApiKey(key);
    if (modelSelect) window.geminiService.setModel(modelSelect.value);
    if (qualitySelect) localStorage.setItem('snapgemini_img_quality', qualitySelect.value);
    if (hapticsCheck) localStorage.setItem('snapgemini_haptics', hapticsCheck.checked);
    if (autoTtsCheck) localStorage.setItem('snapgemini_auto_tts', autoTtsCheck.checked);

    this.updateModelDisplay();
    this.closeSettings();
    window.uiController.showToast('設定已儲存！隨時可拍照', 'check');
  }

  loadSettings() {
    this.updateModelDisplay();
  }

  updateModelDisplay() {
    const tag = document.getElementById('active-model-tag');
    if (tag) {
      const model = window.geminiService.getModel();
      const map = {
        'gemini-2.0-flash': 'Gemini 2.0 Flash',
        'gemini-1.5-flash': 'Gemini 1.5 Flash',
        'gemini-1.5-pro': 'Gemini 1.5 Pro'
      };
      tag.textContent = map[model] || model;
    }
  }

  /**
   * 歷史紀錄管理
   */
  getHistory() {
    try {
      return JSON.parse(localStorage.getItem(this.historyKey) || '[]');
    } catch (e) {
      return [];
    }
  }

  saveToHistory(imageDataUrl, modeName, text) {
    try {
      const history = this.getHistory();
      const newItem = {
        id: Date.now(),
        image: imageDataUrl,
        mode: modeName,
        text: text,
        timestamp: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
        date: new Date().toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })
      };
      // 保留最近 20 筆
      history.unshift(newItem);
      if (history.length > 20) history.pop();
      localStorage.setItem(this.historyKey, JSON.stringify(history));
    } catch (e) {
      console.warn('歷史紀錄儲存失敗（可能空間已滿）:', e);
    }
  }

  openHistory() {
    const modal = document.getElementById('history-modal');
    const list = document.getElementById('history-list');
    if (!modal || !list) return;

    const history = this.getHistory();
    if (history.length === 0) {
      list.innerHTML = `
        <div class="history-empty">
          <i data-lucide="camera" style="width: 36px; height: 36px; color: #475569; margin-bottom: 8px;"></i>
          <p>尚無任何拍攝紀錄</p>
          <span style="font-size: 0.78rem; color: #64748b;">按快門拍攝後將自動保留在此</span>
        </div>
      `;
    } else {
      list.innerHTML = history.map(item => `
        <div class="history-item" onclick="window.app.reopenHistoryItem(${item.id})">
          <img class="history-thumb" src="${item.image}" alt="縮圖" />
          <div class="history-meta">
            <div class="history-top">
              <span class="history-mode">${item.mode}</span>
              <span class="history-date">${item.date} ${item.timestamp}</span>
            </div>
            <div class="history-snippet">${item.text.replace(/[#*`_~>\-\n]/g, ' ').substring(0, 50)}...</div>
          </div>
        </div>
      `).join('');
    }

    if (window.lucide) lucide.createIcons();
    modal.style.display = 'flex';
  }

  closeHistory() {
    const modal = document.getElementById('history-modal');
    if (modal) modal.style.display = 'none';
  }

  clearHistory() {
    if (confirm('確定要清空所有拍攝歷史紀錄嗎？')) {
      localStorage.removeItem(this.historyKey);
      this.openHistory();
      window.uiController.showToast('歷史紀錄已清空', 'trash-2');
    }
  }

  reopenHistoryItem(id) {
    const history = this.getHistory();
    const item = history.find(h => h.id === id);
    if (!item) return;

    this.closeHistory();
    this.lastCapturedImage = item.image;
    this.currentAnalysisText = item.text;

    window.uiController.openResultSheet(item.image, item.mode);
    window.uiController.updateAnalysisMarkdown(item.text);
    window.uiController.finishAnalysis(item.text);
  }
}

// 初始化
window.addEventListener('DOMContentLoaded', () => {
  window.app = new SnapGeminiApp();
});
