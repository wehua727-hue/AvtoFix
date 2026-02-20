import { RequestHandler } from "express";

/**
 * POST /api/resolve-location
 * Resolve shortened Google Maps link to get coordinates
 */
export const handleResolveLocation: RequestHandler = async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    console.log('[ResolveLocation] Resolving URL:', url);

    // Use native fetch (Node 18+) or https module
    let finalUrl = url;
    
    try {
      // Try using native fetch if available
      if (typeof fetch !== 'undefined') {
        const response = await fetch(url, {
          method: 'GET',
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        finalUrl = response.url;
      } else {
        // Fallback to https module
        const https = await import('https');
        
        finalUrl = await new Promise((resolve, reject) => {
          https.get(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
          }, (response) => {
            // Follow redirects manually
            if (response.statusCode === 301 || response.statusCode === 302) {
              resolve(response.headers.location || url);
            } else {
              resolve(response.url || url);
            }
          }).on('error', reject);
        });
      }
    } catch (fetchError) {
      console.error('[ResolveLocation] Fetch error:', fetchError);
      // If fetch fails, try to parse the URL directly
      finalUrl = url;
    }

    console.log('[ResolveLocation] Final URL:', finalUrl);

    // Parse coordinates from the final URL
    let lat: number | null = null;
    let lng: number | null = null;

    // Decode URL first
    const decodedUrl = decodeURIComponent(finalUrl);
    console.log('[ResolveLocation] Decoded URL:', decodedUrl);
    console.log('[ResolveLocation] Starting coordinate extraction...');

    // Format 1: /@lat,lng,zoom in URL (most common Google Maps format)
    // Example: /@41.2995,69.2401,17z or /@41.2995,69.2401
    const atMatch = decodedUrl.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    console.log('[ResolveLocation] @ pattern match:', atMatch);
    if (atMatch) {
      lat = parseFloat(atMatch[1]);
      lng = parseFloat(atMatch[2]);
      console.log('[ResolveLocation] ✓ Extracted from @ format - lat:', lat, 'lng:', lng);
    }

    // Format 2: ?q=lat,lng
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      try {
        const urlObj = new URL(decodedUrl);
        const qParam = urlObj.searchParams.get('q');
        console.log('[ResolveLocation] q parameter:', qParam);
        if (qParam && qParam.includes(',')) {
          const [latStr, lngStr] = qParam.split(',');
          lat = parseFloat(latStr.trim());
          lng = parseFloat(lngStr.trim());
          console.log('[ResolveLocation] Extracted from q param - lat:', lat, 'lng:', lng);
        }
      } catch (e) {
        console.error('[ResolveLocation] URL parse error:', e);
      }
    }

    // Format 3: !3d and !4d parameters (alternative Google Maps format)
    // Example: !3d41.2995!4d69.2401
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      const latMatch = decodedUrl.match(/!3d(-?\d+\.?\d*)/);
      const lngMatch = decodedUrl.match(/!4d(-?\d+\.?\d*)/);
      console.log('[ResolveLocation] !3d pattern match:', latMatch);
      console.log('[ResolveLocation] !4d pattern match:', lngMatch);
      if (latMatch && lngMatch) {
        lat = parseFloat(latMatch[1]);
        lng = parseFloat(lngMatch[2]);
        console.log('[ResolveLocation] ✓ Extracted from !3d/!4d format - lat:', lat, 'lng:', lng);
      }
    }

    // Format 4: /place/.../@lat,lng format (with place name)
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      const placeMatch = decodedUrl.match(/\/place\/[^/]*\/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
      console.log('[ResolveLocation] place pattern match:', placeMatch);
      if (placeMatch) {
        lat = parseFloat(placeMatch[1]);
        lng = parseFloat(placeMatch[2]);
        console.log('[ResolveLocation] ✓ Extracted from place format - lat:', lat, 'lng:', lng);
      }
    }

    // Format 5: data= parameter with coordinates
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      const dataMatch = decodedUrl.match(/data=[^&]*!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
      console.log('[ResolveLocation] data param pattern match:', dataMatch);
      if (dataMatch) {
        lat = parseFloat(dataMatch[1]);
        lng = parseFloat(dataMatch[2]);
        console.log('[ResolveLocation] ✓ Extracted from data param - lat:', lat, 'lng:', lng);
      }
    }

    console.log('[ResolveLocation] Final parsed coordinates - lat:', lat, 'lng:', lng);

    if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
      return res.json({
        success: true,
        location: { lat, lng },
        finalUrl
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'Koordinatalar topilmadi',
        finalUrl
      });
    }
  } catch (error) {
    console.error('[ResolveLocation] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Linkni tekshirib bo\'lmadi'
    });
  }
};
