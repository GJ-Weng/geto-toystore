export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { sym } = req.query;
  if (!sym) return res.status(400).json({ error: 'sym required' });

  const syms = sym.split(',').map(s => s.trim()).filter(Boolean);
  const results = {};

  // Use v7 which returns more complete market data including regularMarketChange
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(syms.join(','))}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,previousClose`;

  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    const quotes = d.quoteResponse?.result || [];

    quotes.forEach(q => {
      const price = q.regularMarketPrice;
      const prev = q.previousClose || q.regularMarketPreviousClose;
      let chg = q.regularMarketChange;
      if ((chg === null || chg === undefined) && prev) {
        chg = price - prev;
      }
      results[q.symbol] = {
        price: price,
        chg: Math.round((chg || 0) * 100) / 100,
        pct: q.regularMarketChangePercent || 0
      };
    });

    // Any symbols not returned get error
    syms.forEach(s => {
      if (!results[s]) results[s] = { error: 'not found' };
    });
  } catch (e) {
    syms.forEach(s => { results[s] = { error: e.message }; });
  }

  res.json(results);
}
