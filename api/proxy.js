export default async function handler(req, res) {
  const { path } = req.query;

  if (!path) {
    return res.status(400).json({ error: 'Missing path parameter' });
  }

  // We use www.reddit.com to ensure we hit the standard API
  const targetUrl = `https://www.reddit.com${path}`;

  try {
    // FIX: Use a unique User-Agent string. 
    // Reddit blocks generic "Mozilla" browser agents from servers.
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'script:g2-glass-reader:v1.0 (by /u/cal_feliciano_dev)'
      }
    });

    if (!response.ok) {
        // This captures the exact reason Reddit said "No" so we can debug if needed
        const errorText = await response.text();
        console.error("Reddit Blocked:", errorText);
        return res.status(response.status).json({ error: 'Reddit blocked request', details: errorText });
    }

    const data = await response.json();

    // Allow your glasses to read this data (CORS)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.status(200).json(data);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
