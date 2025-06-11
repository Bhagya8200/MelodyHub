import React, { useState, useRef, useEffect, useCallback } from "react";
import "./audioPlayer.css";
import Control from "./control";
import ProgressCircle from "./progressCircle";
import WaveAnimation from "./waveAnimation";

function AudioPlayer({
  currentTrack,
  album,
  currentIndex,
  setCurrentIndex,
  total,
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [trackProgress, setTrackProgress] = useState(0);
  const [enhancedPreviewUrl, setEnhancedPreviewUrl] = useState(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [audioReady, setAudioReady] = useState(false);

  const audioRef = useRef();
  const intervalRef = useRef();
  const hasInitialized = useRef(false);
  const isPlayingRef = useRef(false); // Add ref to track playing state

  // Keep isPlayingRef in sync
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Get current track data
  const currentTrackData = total[currentIndex]?.track;

  // Use enhanced URL if available, otherwise fallback to original
  const audioSrc = enhancedPreviewUrl || currentTrackData?.preview_url;

  console.log(
    "AudioPlayer render - currentIndex:",
    currentIndex,
    "track:",
    currentTrackData?.name
  );

  const { duration } = audioRef.current || {};
  const currentPercentage = duration ? (trackProgress / duration) * 100 : 0;

  // Navigation functions - FIXED
  const handleNext = useCallback(() => {
    console.log(
      `🔄 Auto-advancing: ${currentIndex} -> ${
        currentIndex < total.length - 1 ? currentIndex + 1 : 0
      }`
    );

    // Remember if we were playing for auto-continuation
    const wasPlaying = isPlayingRef.current;

    if (currentIndex < total.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      console.log("🔄 Looping back to first track");
      setCurrentIndex(0);
    }

    // IMPORTANT: Maintain playing state for auto-playback
    if (wasPlaying) {
      console.log("▶️ Ensuring playback continues to next track");
      // Don't change isPlaying here - let the effect handle it
      // The playing state will be maintained through the track change
    }
  }, [currentIndex, total.length, setCurrentIndex]);

  const handlePrev = useCallback(() => {
    console.log(`🔄 Moving to previous track from ${currentIndex}`);
    const wasPlaying = isPlayingRef.current;

    if (currentIndex - 1 < 0) {
      setCurrentIndex(total.length - 1);
    } else {
      setCurrentIndex(currentIndex - 1);
    }

    // Maintain playing state
    if (wasPlaying) {
      setIsPlaying(true);
    }
  }, [currentIndex, total.length, setCurrentIndex]);

  // Function to get enhanced preview URL from backend
  const getEnhancedPreviewUrl = useCallback(async (track) => {
    try {
      setIsLoadingPreview(true);

      const songName = track?.name;
      const artistName =
        track?.artists?.[0]?.name || track?.album?.artists?.[0]?.name;

      if (!songName) {
        console.log("No song name available for enhanced preview");
        return null;
      }

      console.log(
        `Requesting enhanced preview for: ${songName} by ${artistName}`
      );

      const response = await fetch("http://localhost:5000/api/get-preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          songName: songName,
          artistName: artistName,
          limit: 3,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.track?.previewUrl) {
        console.log("✓ Enhanced preview URL found:", data.track.previewUrl);
        return data.track.previewUrl;
      } else {
        console.log("✗ No enhanced preview URL found, using original");
        return null;
      }
    } catch (error) {
      console.error("Error fetching enhanced preview URL:", error);
      return null;
    } finally {
      setIsLoadingPreview(false);
    }
  }, []);

  // FIXED startTimer - removed isPlaying dependency to prevent stale closures
  const startTimer = useCallback(() => {
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (audioRef.current) {
        if (audioRef.current.ended) {
          console.log(
            "🔚 Track ended - Current playing state:",
            isPlayingRef.current
          );
          clearInterval(intervalRef.current);

          // Use ref instead of state to avoid stale closure
          if (isPlayingRef.current) {
            console.log("🎵 Auto-advancing to next track...");
            handleNext();
          } else {
            console.log("⏸️ Was paused, not auto-advancing");
          }
        } else {
          setTrackProgress(audioRef.current.currentTime);
        }
      }
    }, 1000);
  }, [handleNext]); // Removed isPlaying dependency

  const stopTimer = useCallback(() => {
    clearInterval(intervalRef.current);
  }, []);

  // Handle play/pause
  const togglePlayback = useCallback(async () => {
    if (!audioRef.current || isLoadingPreview) return;

    try {
      if (isPlaying) {
        audioRef.current.pause();
        stopTimer();
        setIsPlaying(false);
      } else {
        await audioRef.current.play();
        startTimer();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error("Error toggling playback:", error);
      setIsPlaying(false);
    }
  }, [isPlaying, isLoadingPreview, startTimer, stopTimer]);

  // Load and setup audio for current track
  const loadTrack = useCallback(
    async (trackIndex) => {
      console.log(`🎵 Loading track ${trackIndex}...`);

      // Remember if we were playing before track change
      const wasPlaying = isPlayingRef.current;

      // Stop current playback and timer immediately
      stopTimer();

      // Properly cleanup old audio instance
      if (audioRef.current) {
        console.log("🧹 Cleaning up previous audio instance...");
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.src = "";
        audioRef.current.load();
        audioRef.current = null;
      }

      // Reset states
      setTrackProgress(0);
      setEnhancedPreviewUrl(null);
      setAudioReady(false);

      // Get track data
      const trackData = total[trackIndex]?.track;

      if (!trackData) {
        console.log("❌ No track data available for index:", trackIndex);
        setIsPlaying(false);
        return;
      }

      console.log(
        `📀 Track: "${trackData.name}" by ${trackData.artists?.[0]?.name}`
      );

      // Try to get enhanced preview URL
      const enhancedUrl = await getEnhancedPreviewUrl(trackData);
      setEnhancedPreviewUrl(enhancedUrl);

      // Determine final audio source
      const finalAudioSrc = enhancedUrl || trackData.preview_url;

      if (!finalAudioSrc) {
        console.log("❌ No audio source available for this track");
        setIsPlaying(false);
        setAudioReady(true);
        return;
      }

      console.log(
        `🔗 Using audio source:`,
        finalAudioSrc.substring(0, 50) + "..."
      );

      // Create completely new audio instance
      console.log("🆕 Creating new audio instance...");
      audioRef.current = new Audio();

      // Set up event listeners
      const handleLoadedMetadata = () => {
        console.log(
          "✅ Audio metadata loaded, duration:",
          audioRef.current?.duration
        );
        setAudioReady(true);

        // IMPORTANT: Auto-play if we were playing before track change
        if (wasPlaying && hasInitialized.current) {
          console.log("🚀 Auto-continuing playback for new track...");
          setIsPlaying(true);
        }
      };

      const handleCanPlay = () => {
        console.log("✅ Audio can play");
        setAudioReady(true);
      };

      const handleError = (e) => {
        console.error("❌ Audio loading error:", e);
        setIsPlaying(false);
        setAudioReady(true);
      };

      // Add event listeners
      audioRef.current.addEventListener("loadedmetadata", handleLoadedMetadata);
      audioRef.current.addEventListener("canplay", handleCanPlay);
      audioRef.current.addEventListener("error", handleError);

      // Set the source and load
      audioRef.current.src = finalAudioSrc;
      audioRef.current.load();
    },
    [total, getEnhancedPreviewUrl, stopTimer]
  );

  // Effect to load track when currentIndex changes
  useEffect(() => {
    console.log(`🔄 Track index changed to: ${currentIndex}`);
    loadTrack(currentIndex);
  }, [currentIndex, loadTrack]);

  // Effect to handle playback state once audio is ready
  useEffect(() => {
    if (audioReady && audioRef.current && !isLoadingPreview) {
      console.log(
        `🎯 Audio ready for track ${currentIndex}:`,
        `hasInitialized=${hasInitialized.current},`,
        `isPlaying=${isPlaying},`,
        `audioReady=${audioReady}`
      );

      if (!hasInitialized.current) {
        hasInitialized.current = true;
        console.log("✅ First track ready, waiting for user to click play");
      }
    }
  }, [audioReady, currentIndex, isLoadingPreview, isPlaying]);

  // Effect to handle actual play/pause
  useEffect(() => {
    if (!audioReady || !audioRef.current || isLoadingPreview) return;

    if (isPlaying) {
      console.log("▶️ Playing audio...");
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log("✅ Audio started successfully");
            startTimer();
          })
          .catch((error) => {
            console.error("❌ Error playing audio:", error);
            setIsPlaying(false);
          });
      }
    } else {
      console.log("⏸️ Pausing audio...");
      audioRef.current.pause();
      stopTimer();
    }
  }, [isPlaying, audioReady, isLoadingPreview, startTimer, stopTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current.load();
        audioRef.current = null;
      }
    };
  }, [stopTimer]);

  const addZero = (n) => {
    return n > 9 ? "" + n : "0" + n;
  };

  // Get artists array
  const artists = [];
  if (currentTrack?.album?.artists) {
    currentTrack.album.artists.forEach((artist) => {
      artists.push(artist.name);
    });
  } else if (currentTrack?.artists) {
    currentTrack.artists.forEach((artist) => {
      artists.push(artist.name);
    });
  }

  return (
    <div className="player-body flex">
      <div className="player-left-body">
        <ProgressCircle
          percentage={currentPercentage}
          isPlaying={isPlaying && !isLoadingPreview && audioReady}
          image={currentTrack?.album?.images?.[0]?.url}
          size={300}
          color="#C96850"
        />
        {isLoadingPreview && (
          <div
            className="loading-overlay"
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: "rgba(0,0,0,0.7)",
              color: "white",
              padding: "10px 20px",
              borderRadius: "5px",
              fontSize: "14px",
              zIndex: 10,
            }}
          >
            🎵 Finding better preview...
          </div>
        )}
      </div>
      <div className="player-right-body flex">
        <p className="song-title">{currentTrack?.name}</p>
        <p className="song-artist">{artists.join(" | ")}</p>

        {/* Show preview status */}
        <div
          className="preview-status"
          style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}
        >
          {isLoadingPreview ? (
            <span>🔍 Searching for enhanced preview...</span>
          ) : !audioReady ? (
            <span>🔄 Loading audio...</span>
          ) : enhancedPreviewUrl ? (
            <span style={{ color: "#4CAF50" }}>✓ Using enhanced preview</span>
          ) : audioSrc ? (
            <span>🎵 Using original preview</span>
          ) : (
            <span style={{ color: "#ff6b6b" }}>⚠️ No preview available</span>
          )}
        </div>

        <div className="player-right-bottom flex">
          <div className="song-duration flex">
            <p className="duration">0:{addZero(Math.round(trackProgress))}</p>
            <WaveAnimation
              isPlaying={isPlaying && !isLoadingPreview && audioReady}
            />
            <p className="duration">0:30</p>
          </div>
          <Control
            isPlaying={isPlaying && !isLoadingPreview && audioReady}
            setIsPlaying={setIsPlaying}
            togglePlayback={togglePlayback}
            handleNext={handleNext}
            handlePrev={handlePrev}
            total={total}
          />
        </div>
      </div>
    </div>
  );
}

export default AudioPlayer;
