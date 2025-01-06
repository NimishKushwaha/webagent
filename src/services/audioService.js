import axios from 'axios';

class AudioService {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.stream = null;
    this.isRecording = false;
    this.speechRecognition = null;
    this.audioContext = null;
    this.audioProcessor = null;
    this.vadTimeout = null;
    this.silenceThreshold = -50;
    this.silenceDuration = 1500;
    this.lastVoiceDetection = Date.now();
    this.isSpeaking = false;
    this.isRecognitionActive = false;
    this.isSecureContext = window.isSecureContext;
    this.apiBaseUrl = '/api';
    this.setupAudioContext();
    this.setupSpeechRecognition();
  }

  setupAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (error) {
      console.error('Audio Context not supported:', error);
    }
  }

  async setupSpeechRecognition() {
    try {
      // Check for mobile browser support
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const SpeechRecognition = window.SpeechRecognition || 
                               window.webkitSpeechRecognition ||
                               (isMobile ? window.mozSpeechRecognition : null);

      if (SpeechRecognition) {
        this.speechRecognition = new SpeechRecognition();
        this.speechRecognition.continuous = true;
        this.speechRecognition.interimResults = true;
        
        // Add specific settings for mobile
        if (isMobile) {
          this.speechRecognition.interimResults = false; // More stable on mobile
          this.speechRecognition.maxAlternatives = 1;
        }
        
        this.setupSpeechRecognitionHandlers();
      } else {
        throw new Error('Speech Recognition not supported on this device');
      }
    } catch (error) {
      console.error('Error setting up speech recognition:', error);
    }
  }

  setupSpeechRecognitionHandlers() {
    this.speechRecognition.onerror = (event) => {
      console.error('Speech Recognition Error:', event.error);
      if (event.error === 'aborted') {
        this.isRecognitionActive = false;
      } else {
        this.handleRecognitionError(event.error);
      }
    };

    this.speechRecognition.onend = () => {
      this.isRecognitionActive = false;
      if (this.isRecording && !this.isSpeaking) {
        this.startRecognition();
      }
    };
  }

  startRecognition() {
    if (!this.speechRecognition || this.isRecognitionActive) return;

    try {
      this.speechRecognition.start();
      this.isRecognitionActive = true;
    } catch (error) {
      console.error('Error starting recognition:', error);
      this.isRecognitionActive = false;
      // Try to reset speech recognition
      setTimeout(() => {
        this.setupSpeechRecognition();
        this.startRecognition();
      }, 1000);
    }
  }

  stopRecognition() {
    if (!this.speechRecognition || !this.isRecognitionActive) return;

    try {
      this.speechRecognition.stop();
      this.isRecognitionActive = false;
    } catch (error) {
      console.error('Error stopping recognition:', error);
    }
  }

  handleRecognitionError(error) {
    switch (error) {
      case 'network':
        this.fallbackToBasicRecording();
        break;
      case 'not-allowed':
      case 'permission-denied':
        this.isRecording = false;
        throw new Error('Microphone access denied');
      case 'no-speech':
        // Just wait for the next speech input
        break;
      default:
        console.warn('Unhandled recognition error:', error);
    }
  }

  async setupAudioProcessing(stream) {
    if (!this.audioContext) return null;

    try {
      const source = this.audioContext.createMediaStreamSource(stream);
      const analyser = this.audioContext.createAnalyser();
      
      // Create and configure analyser
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      
      source.connect(analyser);

      // Noise reduction
      const filter = this.audioContext.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1000;
      source.connect(filter);
      filter.connect(analyser);

      // Setup periodic analysis
      this.analysisInterval = setInterval(() => {
        const dataArray = new Float32Array(analyser.frequencyBinCount);
        analyser.getFloatFrequencyData(dataArray);
        const average = this.calculateAverageVolume(dataArray);
        
        if (average > this.silenceThreshold) {
          this.lastVoiceDetection = Date.now();
          this.handleVoiceDetected();
        } else {
          this.checkSilence();
        }
      }, 100); // Check every 100ms

      return analyser;
    } catch (error) {
      console.error('Error setting up audio processing:', error);
      return null;
    }
  }

  calculateAverageVolume(dataArray) {
    const values = dataArray.reduce((sum, value) => sum + value, 0);
    return values / dataArray.length;
  }

  handleVoiceDetected() {
    if (this.vadTimeout) {
      clearTimeout(this.vadTimeout);
      this.vadTimeout = null;
    }
  }

  checkSilence() {
    const timeSinceLastVoice = Date.now() - this.lastVoiceDetection;
    if (timeSinceLastVoice > this.silenceDuration && !this.vadTimeout) {
      this.vadTimeout = setTimeout(() => {
        if (this.onSilenceCallback) {
          this.onSilenceCallback();
        }
      }, 500);
    }
  }

  async startRecording(onTranscript, onSilence) {
    try {
      // Debug logging
      console.log('Secure context:', window.isSecureContext);
      console.log('MediaDevices available:', !!navigator.mediaDevices);
      
      // Check permissions
      const permissionResult = await navigator.permissions.query({ name: 'microphone' });
      console.log('Microphone permission:', permissionResult.state);

      // Check for secure context
      if (!window.isSecureContext) {
        throw new Error('Secure context (HTTPS) required for audio input');
      }

      // Check for permissions first
      if (permissionResult.state === 'denied') {
        throw new Error('Microphone permission denied');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1
        }
      });

      this.stream = stream;
      this.isRecording = true;
      this.onSilenceCallback = onSilence;
      this.audioProcessor = await this.setupAudioProcessing(this.stream);

      this.speechRecognition.onresult = (event) => {
        if (!this.isSpeaking) {
          const transcript = Array.from(event.results)
            .map(result => result[0].transcript)
            .join('');
          
          if (event.results[0].isFinal) {
            onTranscript(transcript);
          }
        }
      };

      this.startRecognition();
      return true;
    } catch (error) {
      console.error('Error starting recording:', error);
      return false;
    }
  }

  stopRecording() {
    this.isRecording = false;
    this.stopRecognition();
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }
    if (this.vadTimeout) {
      clearTimeout(this.vadTimeout);
      this.vadTimeout = null;
    }
  }

  async speakResponse(text) {
    try {
      this.isSpeaking = true;
      this.stopRecognition();

      const response = await fetch(`${this.apiBaseUrl}/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          voice: 'shimmer',
          speed: 1.0
        })
      });

      if (!response.ok) {
        throw new Error('TTS API request failed');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      return new Promise((resolve) => {
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          this.isSpeaking = false;
          setTimeout(() => {
            if (this.isRecording) {
              this.startRecognition();
            }
            resolve(true);
          }, 1000);
        };

        audio.onerror = (error) => {
          console.error('Audio playback error:', error);
          this.isSpeaking = false;
          resolve(false);
        };

        audio.play().catch(error => {
          console.error('Error playing audio:', error);
          this.isSpeaking = false;
          resolve(false);
        });
      });
    } catch (error) {
      console.error('Error in text-to-speech:', error);
      return this.fallbackTTS(text);
    }
  }

  async fallbackTTS(text) {
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      return new Promise((resolve) => {
        utterance.onend = () => {
          this.isSpeaking = false;
          setTimeout(() => {
            if (this.isRecording) {
              this.startRecognition();
            }
            resolve(true);
          }, 1000);
        };
        
        utterance.onerror = (error) => {
          console.error('Speech synthesis error:', error);
          this.isSpeaking = false;
          resolve(false);
        };
        
        speechSynthesis.speak(utterance);
      });
    } catch (error) {
      console.error('Error in fallback TTS:', error);
      this.isSpeaking = false;
      return false;
    }
  }

  async getAIResponse(userMessage) {
    try {
      const response = await axios.post(`${this.apiBaseUrl}/chat`, {
        message: userMessage,
        context: this.conversationContext || [],
        timestamp: new Date().toISOString()
      }, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.data.status === 'success') {
        this.conversationContext = [
          ...(this.conversationContext || []).slice(-5),
          { role: 'user', content: userMessage },
          { role: 'assistant', content: response.data.response }
        ];

        return response.data.response;
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Error getting AI response:', error);
      return "I apologize, but I'm having trouble processing your request at the moment.";
    }
  }

  fallbackToBasicRecording() {
    if (MediaRecorder && this.stream) {
      this.mediaRecorder = new MediaRecorder(this.stream);
      this.audioChunks = [];
      
      this.mediaRecorder.ondataavailable = (event) => {
        this.audioChunks.push(event.data);
      };

      this.mediaRecorder.onstop = async () => {
        this.audioChunks = [];
      };

      this.mediaRecorder.start();
    }
  }
}

export default new AudioService(); 