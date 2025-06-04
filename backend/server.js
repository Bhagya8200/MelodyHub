// IMPORTANT: This must be the first line in your main file
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";

// Import the spotify-preview-finder package
import spotifyPreviewFinder from "spotify-preview-finder";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 5000;

// Validate environment variables on startup
const validateEnvironment = () => {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    console.error("❌ Missing Spotify credentials!");
    console.error("Please set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in your .env file");
    return false;
  }
  
  console.log("✅ Spotify credentials found");
  return true;
};

// New endpoint to get preview URL using spotify-preview-finder
app.post("/api/get-preview", async (req, res) => {
  try {
    const { songName, artistName, limit = 3 } = req.body;

    console.log("Received request:", { songName, artistName, limit });

    if (!songName) {
      return res.status(400).json({
        success: false,
        error: "Song name is required",
      });
    }

    // Validate environment variables before making API calls
    if (!validateEnvironment()) {
      return res.status(500).json({
        success: false,
        error: "Spotify credentials not configured",
      });
    }

    // Combine song and artist name for better search results
    const searchQuery = artistName ? `${songName} ${artistName}` : songName;

    console.log(`🔍 Searching for: "${searchQuery}"`);

    // Use the spotify-preview-finder package
    const result = await spotifyPreviewFinder(searchQuery, limit);

    console.log("Spotify API result:", {
      success: result.success,
      resultCount: result.results?.length || 0,
      error: result.error
    });

    if (result.success && result.results.length > 0) {
      // Get the best match (first result)
      const bestMatch = result.results[0];

      console.log(`✅ Found ${result.results.length} results for "${searchQuery}"`);
      console.log(`🎵 Best match: "${bestMatch.name}" by ${bestMatch.artist}`);
      console.log(`🔗 Preview URLs available: ${bestMatch.previewUrls.length}`);
      
      if (bestMatch.previewUrls.length === 0) {
        console.log("⚠️ No preview URLs found for best match");
        return res.json({
          success: false,
          error: "No preview URLs available for this track",
          searchQuery,
          foundTrack: {
            name: bestMatch.name,
            artist: bestMatch.artist
          }
        });
      }

      res.json({
        success: true,
        track: {
          name: bestMatch.name,
          artist: bestMatch.artist,
          previewUrl: bestMatch.previewUrls[0], // Use the first preview URL
          spotifyUrl: bestMatch.spotifyUrl,
          albumImage: bestMatch.albumImage,
          duration: bestMatch.duration,
          id: bestMatch.id,
          allPreviewUrls: bestMatch.previewUrls, // Include all available preview URLs
        },
        allResults: result.results.map(track => ({
          name: track.name,
          artist: track.artist,
          previewUrlCount: track.previewUrls.length,
          hasPreview: track.previewUrls.length > 0
        })),
        searchQuery
      });
    } else {
      console.log(`❌ No results found for "${searchQuery}"`);
      console.log("Error details:", result.error);
      
      res.json({
        success: false,
        error: result.error || "No preview URL found for this song",
        searchQuery,
        suggestion: "Try searching with different keywords or check if the song exists on Spotify"
      });
    }
  } catch (error) {
    console.error("❌ Error in /api/get-preview:", error);
    
    // More detailed error logging
    if (error.response) {
      console.error("API Response Error:", {
        status: error.response.status,
        data: error.response.data
      });
    }
    
    res.status(500).json({
      success: false,
      error: "Internal server error: " + error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Test endpoint to verify spotify-preview-finder is working
app.get("/api/test-spotify", async (req, res) => {
  try {
    console.log("🧪 Testing spotify-preview-finder...");
    
    if (!validateEnvironment()) {
      return res.status(500).json({
        error: "Spotify credentials not configured",
        configured: false
      });
    }
    
    const testResult = await spotifyPreviewFinder("Shape of You Ed Sheeran", 1);
    
    console.log("Test result:", testResult);
    
    res.json({
      message: "Spotify preview finder test",
      result: testResult,
      configured: true,
      testQuery: "Shape of You Ed Sheeran"
    });
  } catch (error) {
    console.error("❌ Spotify preview finder test failed:", error);
    res.status(500).json({
      error: "Spotify preview finder test failed",
      details: error.message,
      configured: !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET),
    });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: {
      spotifyConfigured: !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET)
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend listening on http://localhost:${PORT}`);
  console.log("\n📊 Environment check:");
  console.log("- Spotify Client ID:", process.env.SPOTIFY_CLIENT_ID ? "Configured ✅" : "Missing ❌");
  console.log("- Spotify Client Secret:", process.env.SPOTIFY_CLIENT_SECRET ? "Configured ✅" : "Missing ❌");
  
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    console.log("\n⚠️  WARNING: Spotify credentials missing!");
    console.log("Please create a .env file with:");
    console.log("SPOTIFY_CLIENT_ID=your_client_id");
    console.log("SPOTIFY_CLIENT_SECRET=your_client_secret");
  }
  
  console.log("\n🔗 Available endpoints:");
  console.log(`- POST http://localhost:${PORT}/api/get-preview`);
  console.log(`- GET  http://localhost:${PORT}/api/test-spotify`);
  console.log(`- GET  http://localhost:${PORT}/api/health`);
});