/**
 * SnapGemini - UI Controller & Interactions
 * Manages Bottom Sheet, Markdown Streaming, TTS Speech, Audio FX & Haptics
 */

class UIController {
  constructor() {
    this.audioCtx = null;
    this.isSpeaking = false;
    this.speechUtterance = null;
    this.initAudio();
  }

  initAudio() {
    // 延遲初始化 Web Audio API
    window.addEventListener('click', () => {
      if (!this.audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.audioCtx = new AudioContext();
        }
      }
    }, { once: true });
  }

  /**
   * 播放合成的高質感快門音效
   */
  playShutterSound() {
    const hapticsEnabled = localStorage.getItem('snapgemini_haptics') !== 'false';
    if (!hapticsEnabled) return;

    // 觸覺震動 (Android / Mobile 支援)
    if (navigator.vibrate) {
      try {
        navigator.vibrate([35, 20, 25]);
      } catch (e) {}
    }

    // Web Audio 合成快門聲
    try {
      if (!this.audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) this.audioCtx = new AudioContext();
      }
      if (!this.audioCtx) return;

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;

      // 產生短促白噪音 (模擬機械快門震動)
      const bufferSize = this.audioCtx.sampleRate * 0.05;
      const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.audioCtx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 1200;

      const gain = this.audioCtx.createGain();
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.045);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.audioCtx.destination);

      noise.start(now);

      // 伴隨一聲清脆微音 (Blip)
      const osc = this.audioCtx.createOscillator();
      const oscGain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1800, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.04);

      oscGain.gain.setValueAtTime(0.2, now);
      oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.04);

      osc.connect(oscGain);
      oscGain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.05);

    } catch (err) {
      console.warn('音效播放失敗:', err);
    }
  }

  /**
   * 顯示 Toast 浮動提示
   */
  showToast(message, iconName = 'info', duration = 2500) {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-message');
    const toastIcon = document.getElementById('toast-icon');

    if (!toast || !toastMsg) return;

    toastMsg.textContent = message;
    if (toastIcon) {
      toastIcon.setAttribute('data-lucide', iconName);
      if (window.lucide) lucide.createIcons();
    }

    toast.style.display = 'flex';
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      toast.style.display = 'none';
    }, duration);
  }

  /**
   * 開啟分析結果 Bottom Sheet
   */
  openResultSheet(imageDataUrl, modeName) {
    const sheet = document.getElementById('result-sheet');
    const previewImg = document.getElementById('captured-preview-img');
    const modeTag = document.getElementById('sheet-mode-tag');
    const timeTag = document.getElementById('sheet-time');
    const statusPill = document.getElementById('analysis-status-pill');
    const statusText = document.getElementById('status-text');
    const output = document.getElementById('analysis-output');
    const followup = document.getElementById('followup-container');

    if (previewImg) previewImg.src = imageDataUrl;
    if (modeTag) modeTag.textContent = modeName;
    if (timeTag) timeTag.textContent = '剛剛';
    
    if (statusPill) {
      statusPill.style.display = 'inline-flex';
      statusPill.className = 'status-pill status-loading';
    }
    if (statusText) statusText.textContent = 'Gemini 分析中...';

    if (output) {
      output.innerHTML = `
        <div class="loading-placeholder">
          <div class="shimmer-line title"></div>
          <div class="shimmer-line text"></div>
          <div class="shimmer-line text short"></div>
          <div class="shimmer-line text"></div>
        </div>
      `;
    }

    if (followup) followup.style.display = 'none';

    sheet.classList.add('open');
  }

  /**
   * 關閉結果 Sheet
   */
  closeResultSheet() {
    const sheet = document.getElementById('result-sheet');
    sheet.classList.remove('open');
    this.stopTTS();
  }

  /**
   * 即時更新 Markdown 結果
   */
  updateAnalysisMarkdown(markdownText) {
    const output = document.getElementById('analysis-output');
    if (!output) return;

    if (window.marked) {
      output.innerHTML = marked.parse(markdownText);
    } else {
      output.textContent = markdownText;
    }
  }

  /**
   * 分析完成狀態更新
   */
  finishAnalysis(fullMarkdown) {
    const statusPill = document.getElementById('analysis-status-pill');
    const statusText = document.getElementById('status-text');
    const followup = document.getElementById('followup-container');

    if (statusPill) {
      statusPill.className = 'status-pill';
      statusPill.style.background = 'rgba(16, 185, 129, 0.15)';
      statusPill.style.color = '#34d399';
      statusPill.style.border = '1px solid rgba(52, 211, 153, 0.3)';
    }
    if (statusText) statusText.textContent = '分析完成';
    if (followup) followup.style.display = 'block';

    // 若開啟了自動朗讀
    const autoTTS = localStorage.getItem('snapgemini_auto_tts') === 'true';
    if (autoTTS && fullMarkdown) {
      this.toggleTTS(fullMarkdown);
    }
  }

  /**
   * 分析發生錯誤
   */
  showAnalysisError(errorType, customMsg = '') {
    const statusPill = document.getElementById('analysis-status-pill');
    const statusText = document.getElementById('status-text');
    const output = document.getElementById('analysis-output');

    if (statusPill) {
      statusPill.className = 'status-pill';
      statusPill.style.background = 'rgba(239, 68, 68, 0.15)';
      statusPill.style.color = '#f87171';
      statusPill.style.border = '1px solid rgba(248, 113, 113, 0.3)';
    }
    if (statusText) statusText.textContent = '分析中斷';

    let errorHtml = '';
    if (errorType === 'MISSING_API_KEY') {
      errorHtml = `
        <div style="padding: 16px; background: rgba(239,68,68,0.1); border-radius: 12px; border: 1px solid rgba(239,68,68,0.3);">
          <h4 style="color: #f87171; margin-bottom: 8px;">🔑 尚未設定 Gemini API Key</h4>
          <p style="font-size: 0.88rem; color: #cbd5e1; margin-bottom: 12px;">
            請點擊右上角「齒輪圖示」或下方按鈕貼上您的 API Key，即可開始極速拍照分析。
          </p>
          <button onclick="window.app.openSettings()" class="btn-primary-sm" style="width: 100%;">
            立即設定 API Key
          </button>
        </div>
      `;
    } else if (errorType === 'INVALID_API_KEY') {
      errorHtml = `
        <div style="padding: 16px; background: rgba(239,68,68,0.1); border-radius: 12px; border: 1px solid rgba(239,68,68,0.3);">
          <h4 style="color: #f87171; margin-bottom: 8px;">❌ API Key 無效或授權失敗</h4>
          <p style="font-size: 0.88rem; color: #cbd5e1; margin-bottom: 12px;">
            請檢查您的 API Key 是否複製完整或是否有啟用 Gemini API 權限。
          </p>
          <button onclick="window.app.openSettings()" class="btn-primary-sm" style="width: 100%;">
            重新輸入 API Key
          </button>
        </div>
      `;
    } else {
      errorHtml = `
        <div style="padding: 16px; background: rgba(239,68,68,0.1); border-radius: 12px; border: 1px solid rgba(239,68,68,0.3);">
          <h4 style="color: #f87171; margin-bottom: 8px;">⚠️ 分析發生問題</h4>
          <p style="font-size: 0.85rem; color: #cbd5e1;">${customMsg || errorType}</p>
        </div>
      `;
    }

    if (output) output.innerHTML = errorHtml;
  }

  /**
   * 語音朗讀 (Text-to-Speech)
   */
  toggleTTS(rawText) {
    if (!('speechSynthesis' in window)) {
      this.showToast('瀏覽器不支援語音朗讀', 'volume-x');
      return;
    }

    const ttsBtn = document.getElementById('btn-tts');

    if (this.isSpeaking) {
      this.stopTTS();
      return;
    }

    // 去除 Markdown 標籤以提供最自然的朗讀
    const cleanText = rawText
      .replace(/[#*`_~>\-\[\]\(\)]/g, ' ')
      .replace(/\n+/g, '，')
      .trim();

    if (!cleanText) return;

    this.speechUtterance = new SpeechSynthesisUtterance(cleanText);
    this.speechUtterance.lang = 'zh-TW';
    this.speechUtterance.rate = 1.05; // 稍微輕快

    // 尋找最佳繁體中文語音庫
    const voices = window.speechSynthesis.getVoices();
    const zhVoice = voices.find(v => v.lang === 'zh-TW' || v.lang === 'zh-HK' || v.lang.startsWith('zh'));
    if (zhVoice) {
      this.speechUtterance.voice = zhVoice;
    }

    this.speechUtterance.onstart = () => {
      this.isSpeaking = true;
      if (ttsBtn) ttsBtn.classList.add('active');
    };

    this.speechUtterance.onend = () => {
      this.isSpeaking = false;
      if (ttsBtn) ttsBtn.classList.remove('active');
    };

    this.speechUtterance.onerror = () => {
      this.isSpeaking = false;
      if (ttsBtn) ttsBtn.classList.remove('active');
    };

    window.speechSynthesis.cancel(); // 停止先前的朗讀
    window.speechSynthesis.speak(this.speechUtterance);
  }

  stopTTS() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.isSpeaking = false;
    const ttsBtn = document.getElementById('btn-tts');
    if (ttsBtn) ttsBtn.classList.remove('active');
  }
}

window.uiController = new UIController();
