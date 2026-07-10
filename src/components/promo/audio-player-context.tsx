"use client";

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from "react";

// ── State ───────────────────────────────────────────────────────────────────

export interface PlayerTrack {
  id: string;
  title: string;
  artistName: string;
  mixVersion: string | null;
  campaignId: string;
  /** presigned URL — fetched on demand, cached while valid */
  streamUrl: string | null;
  /** presigned URL for cover art display in the player bar */
  artworkUrl: string | null;
}

interface PlayerState {
  currentTrack: PlayerTrack | null;
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  volume: number;
}

type PlayerAction =
  | { type: "LOAD_TRACK"; track: PlayerTrack }
  | { type: "SET_STREAM_URL"; trackId: string; url: string }
  | { type: "PLAY" }
  | { type: "PAUSE" }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_TIME"; time: number }
  | { type: "SET_DURATION"; duration: number }
  | { type: "SET_VOLUME"; volume: number }
  | { type: "STOP" };

function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case "LOAD_TRACK":
      return {
        ...state,
        currentTrack: action.track,
        isPlaying: false,
        isLoading: true,
        currentTime: 0,
        duration: 0,
      };
    case "SET_STREAM_URL":
      if (state.currentTrack?.id !== action.trackId) return state;
      return {
        ...state,
        currentTrack: { ...state.currentTrack, streamUrl: action.url },
      };
    case "PLAY":
      return { ...state, isPlaying: true };
    case "PAUSE":
      return { ...state, isPlaying: false };
    case "SET_LOADING":
      return { ...state, isLoading: action.loading };
    case "SET_TIME":
      return { ...state, currentTime: action.time };
    case "SET_DURATION":
      return { ...state, duration: action.duration, isLoading: false };
    case "SET_VOLUME":
      return { ...state, volume: action.volume };
    case "STOP":
      return { ...state, isPlaying: false, currentTime: 0 };
    default:
      return state;
  }
}

// ── Context ──────────────────────────────────────────────────────────────────

interface AudioPlayerContextValue {
  state: PlayerState;
  playTrack: (track: PlayerTrack) => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  setVolume: (vol: number) => void;
  audioRef: React.RefObject<HTMLAudioElement | null>;
}

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null);

export function useAudioPlayer() {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) throw new Error("useAudioPlayer must be used inside AudioPlayerProvider");
  return ctx;
}

// ── Provider ─────────────────────────────────────────────────────────────────

const INITIAL_STATE: PlayerState = {
  currentTrack: null,
  isPlaying: false,
  isLoading: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
};

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(playerReducer, INITIAL_STATE);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Wire up the HTML audio element events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => dispatch({ type: "SET_TIME", time: audio.currentTime });
    const onDurationChange = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        dispatch({ type: "SET_DURATION", duration: audio.duration });
      }
    };
    const onPlay = () => dispatch({ type: "PLAY" });
    const onPause = () => dispatch({ type: "PAUSE" });
    const onWaiting = () => dispatch({ type: "SET_LOADING", loading: true });
    const onCanPlay = () => dispatch({ type: "SET_LOADING", loading: false });
    const onEnded = () => dispatch({ type: "STOP" });

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  // Sync isPlaying state → actual audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (state.isPlaying) {
      audio.play().catch(() => dispatch({ type: "PAUSE" }));
    } else {
      audio.pause();
    }
  }, [state.isPlaying]);

  // Load new src when track + URL become available
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !state.currentTrack?.streamUrl) return;

    audio.src = state.currentTrack.streamUrl;
    audio.load();
    audio.play().catch(() => dispatch({ type: "PAUSE" }));
    dispatch({ type: "PLAY" });
  }, [state.currentTrack?.streamUrl]);

  const playTrack = useCallback(async (track: PlayerTrack) => {
    dispatch({ type: "LOAD_TRACK", track });

    if (track.streamUrl) {
      // URL already cached
      dispatch({ type: "SET_STREAM_URL", trackId: track.id, url: track.streamUrl });
      return;
    }

    // Fetch presigned URL from API
    try {
      const res = await fetch(
        `/api/promo/stream/${track.id}?campaignId=${track.campaignId}`,
      );
      if (!res.ok) throw new Error("Failed to fetch stream URL");
      const data = await res.json() as { url: string };
      dispatch({ type: "SET_STREAM_URL", trackId: track.id, url: data.url });
    } catch {
      dispatch({ type: "SET_LOADING", loading: false });
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (state.isPlaying) {
      dispatch({ type: "PAUSE" });
    } else {
      dispatch({ type: "PLAY" });
    }
  }, [state.isPlaying]);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
    dispatch({ type: "SET_TIME", time });
  }, []);

  const setVolume = useCallback((vol: number) => {
    const audio = audioRef.current;
    if (audio) audio.volume = vol;
    dispatch({ type: "SET_VOLUME", volume: vol });
  }, []);

  return (
    <AudioPlayerContext.Provider
      value={{ state, playTrack, togglePlay, seek, setVolume, audioRef }}
    >
      {/* Hidden HTML audio element — persists across navigations */}
      <audio ref={audioRef} preload="none" />
      {children}
    </AudioPlayerContext.Provider>
  );
}
