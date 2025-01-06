import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure dotenv to look for .env in root directory
dotenv.config({ path: path.join(__dirname, '../.env') });

// Verify the API key is loaded
if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is not set in environment variables');
  process.exit(1);
}

const app = express();
const { PORT = 5000 } = process.env;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, '../dist')));

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
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

// TTS endpoint
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

// Serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 