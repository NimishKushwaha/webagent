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

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Chat API called with OpenAI key:', process.env.OPENAI_API_KEY ? 'Present' : 'Missing');

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const { message, context } = req.body;
    console.log('Request body:', { message, contextLength: context?.length });

    const messages = [
      {
        role: 'system',
        content: `You are an AI sales representative...`
      },
      ...(context || []).map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      {
        role: 'user',
        content: message
      }
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages,
      temperature: 0.7,
      max_tokens: 150
    });

    res.json({
      response: completion.choices[0].message.content,
      status: 'success'
    });
  } catch (error) {
    console.error('Detailed error:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
} 