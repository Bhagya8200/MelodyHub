// spotifyAuth.js - Add this to your backend
import axios from 'axios';

class SpotifyAuthService {
  constructor() {
    this.clientId = process.env.SPOTIFY_CLIENT_ID;
    this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  // Get Client Credentials access token (for search without user authentication)
  async getAccessToken() {
    try {
      // Check if current token is still valid
      if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
        return this.accessToken;
      }

      const response = await axios.post('https://accounts.spotify.com/api/token', 
        'grant_type=client_credentials', 
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
          }
        }
      );

      this.accessToken = response.data.access_token;
      // Set expiry time (usually 3600 seconds = 1 hour)
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
      
      return this.accessToken;
    } catch (error) {
      console.error('Error getting Spotify access token:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with Spotify');
    }
  }

  // Search for tracks
  async searchTracks(query, limit = 10) {
    try {
      const token = await this.getAccessToken();
      
      const response = await axios.get('https://api.spotify.com/v1/search', {
        params: {
          q: query,
          type: 'track',
          limit: limit
        },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      return response.data.tracks.items;
    } catch (error) {
      console.error('Error searching Spotify tracks:', error.response?.data || error.message);
      throw new Error('Failed to search Spotify tracks');
    }
  }
}

export default SpotifyAuthService;