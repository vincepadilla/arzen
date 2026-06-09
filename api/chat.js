export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API key is not configured in environment variables' });
  }

  const systemInstruction = `You are a virtual assistant for Arzen Louse P. Navor, a Licensed Civil Engineer specializing in Structural & Infrastructure Engineering.
He holds a B.S. in Civil Engineering from Saint Louise College and is licensed in multiple states.
His expertise covers AASHTO bridge standards, ACI concrete design, AISC steel design, and modern BIM workflows.
His skills include: Structural Analysis, Bridge Design, Foundation Engineering, CAD/AutoCAD, BIM/Revit, SAP2000/ETABS, Geotechnical Eval, Project Management, AASHTO Standards, Seismic Design.
Projects he worked on:
1. Four-Storey Building: Feasibility study for a Municipal Hall at Luna, La Union. Roles: architectural design, structural design/analysis, structural estimation.
2. BIM Modeling: Two-storey residential building with roof deck and basement using Autodesk Revit.
3. Linear and Nonlinear Seismic Evaluation of a Reinforced Concrete Building: Evaluated seismic performance using STAAD.Pro and STERA 3D.

CRITICAL RULE: You must ONLY answer questions related to civil engineering, structural engineering, or Arzen's background, experience, and qualifications. If a user asks a question unrelated to these topics (e.g., coding, general knowledge, math not related to his field, etc.), you must politely decline and state that you can only answer questions related to civil engineering and Arzen's professional background. Keep your answers concise and professional.`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: message }]
          }
        ],
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        }
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to fetch from Gemini API');
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I couldn't generate a response at this time.";
    return res.status(200).json({ reply });

  } catch (error) {
    console.error('Gemini API Error:', error);
    return res.status(500).json({ error: 'Failed to communicate with the AI model' });
  }
}
