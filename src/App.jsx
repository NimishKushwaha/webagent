import { useState, useEffect, useRef } from 'react';
import CallControls from './components/CallControls';
import ChatMessage from './components/ChatMessage';
import StatusIndicator from './components/StatusIndicator';
import audioService from './services/audioService';
import './styles/components.css';

function App() {
  const [isCallActive, setIsCallActive] = useState(false);
  const [status, setStatus] = useState('Not connected');
  const [messages, setMessages] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const chatContainerRef = useRef(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSilence = () => {
    if (isCallActive) {
      setStatus('Silence detected...');
      // Optional: Prompt user to continue speaking
      audioService.speakResponse("I'm still listening. Please continue when you're ready.");
    }
  };

  const handleTranscript = async (transcript) => {
    if (!isProcessing) {
      setIsProcessing(true);
      setStatus('Processing...');
      addMessage(transcript, 'user');
      
      try {
        const aiResponse = await audioService.getAIResponse(transcript);
        addMessage(aiResponse, 'ai');
        await audioService.speakResponse(aiResponse);
      } catch (error) {
        console.error('Error processing response:', error);
        const errorMessage = "I apologize, but I encountered an error. Could you please repeat that?";
        addMessage(errorMessage, 'ai');
        await audioService.speakResponse(errorMessage);
      } finally {
        setIsProcessing(false);
        setStatus('Listening...');
      }
    }
  };

  const handleStartCall = async () => {
    const success = await audioService.startRecording(handleTranscript, handleSilence);
    if (success) {
      setIsCallActive(true);
      setStatus('Listening...');
      const welcomeMessage = "Hello! I'm an AI sales representative. How can I help you today?";
      addMessage(welcomeMessage, 'ai');
      await audioService.speakResponse(welcomeMessage);
    } else {
      setStatus('Error: Could not access microphone');
    }
  };

  const handleEndCall = () => {
    audioService.stopRecording();
    setIsCallActive(false);
    setStatus('Call ended');
    const goodbyeMessage = 'Thank you for your time. Have a great day!';
    addMessage(goodbyeMessage, 'ai');
    audioService.speakResponse(goodbyeMessage);
  };

  const addMessage = (text, type) => {
    setMessages(prev => [...prev, { text, type }]);
  };

  return (
    <div className="container">
      <div className="chat-container">
        <div className="chat-header">
          <h1>AI Sales Assistant</h1>
        </div>
        <div className="chat-messages" ref={chatContainerRef}>
          {messages.map((message, index) => (
            <ChatMessage 
              key={index}
              message={message.text}
              type={message.type}
            />
          ))}
        </div>
        <StatusIndicator status={status} />
        <CallControls 
          isCallActive={isCallActive}
          onStartCall={handleStartCall}
          onEndCall={handleEndCall}
        />
      </div>
    </div>
  );
}

export default App; 