import axios from "axios";

const authEndpoint = "https://accounts.spotify.com/authorize?";
const clientId = "6fa07bea440e4537804e2c81e3459ceb";
const redirectUri = "http://localhost:3000/";
const scopes = [
  "user-read-private",
  "user-read-email",
  "user-library-read",
  "playlist-read-private",
];

export const loginEndpoint = `${authEndpoint}client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scopes.join(
  "%20"
)}&response_type=token&show_dialog=true`;

const apiClient = axios.create({
  baseURL: "https://api.spotify.com/v1/",
});

export const setClientToken = (token) => {
  apiClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;
};

export default apiClient;
