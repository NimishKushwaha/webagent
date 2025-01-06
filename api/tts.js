import { OpenAI } from 'openai';

export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('TTS API called with OpenAI key:', process.env.OPENAI_API_KEY ? 'Present' : 'Missing');
    
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const { text, voice, speed } = req.body;
    console.log('Request body:', { text, voice, speed });

    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: voice,
      input: text,
      speed: speed
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (error) {
    console.error('Detailed error:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
} 