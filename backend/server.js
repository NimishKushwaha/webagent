import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const app = express();
const { PORT = 5000, OPENAI_API_KEY } = process.env;

// Middleware
app.use(cors({
  origin: ['https://aiwebagent.vercel.app', 'http://localhost:3000', 'http://localhost:5173'],
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json());

// Initialize OpenAI with the new configuration
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, context } = req.body;

    // Prepare conversation history
    const conversationHistory = context.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // Add system message for AI behavior
    const messages = [
      {
        role: 'system',
        content: `You are an AI sales representative. Your goal is to be helpful, 
                 professional, and persuasive while maintaining a natural conversation flow. 
                 Keep responses concise and focused on addressing the customer's needs.`
      },
      ...conversationHistory,
      {
        role: 'user',
        content: message
      }
    ];

    try {
      // Use gpt-4o-mini model
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: messages,
        temperature: 0.7,
        max_tokens: 150,
        presence_penalty: 0.6,
        store: true
      });

      const aiResponse = completion.choices[0].message.content;
      res.json({
        response: aiResponse,
        status: 'success'
      });
    } catch (modelError) {
      console.error('Model error:', modelError);
      // Use mock response if model fails
      const mockResponse = generateMockResponse(message);
      res.json({
        response: mockResponse,
        status: 'success'
      });
    }
  } catch (error) {
    console.error('Error in chat endpoint:', error);
    res.status(500).json({
      error: 'An error occurred while processing your request',
      details: error.message
    });
  }
});

// Add TTS endpoint
app.post('/api/tts', async (req, res) => {
  try {
    const { text, voice, speed } = req.body;

    const mp3 = await openai.audio.speech.create({
      model: "tts-1",  // or "tts-1-hd" for higher quality
      voice: voice,    // 'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'
      input: text,
      speed: speed
    });

    // Convert the raw response to a buffer
    const buffer = Buffer.from(await mp3.arrayBuffer());

    // Set response headers
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': buffer.length,
    });

    // Send the audio data
    res.send(buffer);
  } catch (error) {
    console.error('Error in TTS endpoint:', error);
    res.status(500).json({
      error: 'Failed to generate speech',
      details: error.message
    });
  }
});

// Helper function to generate mock responses when API fails
function generateMockResponse(message) {
  const responses = [
    `I understand your interest in "${message}". Could you tell me more about your specific needs?`,
    `Thank you for asking about "${message}". How would you like me to help you with that?`,
    `I'd be happy to assist you with "${message}". What aspects are most important to you?`,
    `Regarding "${message}", could you share what solutions you've tried before?`
  ];
  
  return responses[Math.floor(Math.random() * responses.length)];
}

// Error handling middleware
app.use((err, req, res) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    details: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 