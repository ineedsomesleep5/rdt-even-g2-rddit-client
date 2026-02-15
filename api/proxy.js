export default async function handler(req, res) {
  // 1. Get the "path" from the query (e.g., /r/funny/top.json)
  const { path } = req.query;

  if (!path) {
    return res.status(400).json({ error: 'Missing path parameter' });
  }

  // 2. Define the Reddit URL
  const targetUrl = `https://www.reddit.com${path}`;

  try {
    // 3. Fetch from Reddit server-side (pretending to be a desktop browser)
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
        return res.status(response.status).json({ error: 'Reddit blocked the request' });
    }

    const data = await response.json();

    // 4. Send back to glasses with strict CORS permissions
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.status(200).json(data);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
