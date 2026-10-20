import React, { useRef, useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  PictureInPicture,
  Settings,
  Check,
  AlertTriangle,
  RefreshCw,
  FastForward,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export interface VideoPlayerProps {
  videoUrl: string;
  serverUrls?: string[];
  title: string;
  animeTitle: string;
  animeMalId: number;
  episodeNumber: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  posterUrl?: string | null;
  thumbnailUrl?: string | null;
  subtitleUrl?: string | null;
  autoPlay?: boolean;
  autoNext?: boolean;
  autoSkip?: boolean;
  lightsOff?: boolean;
  activeServerIndex?: number;
  onServerIndexChange?: (index: number) => void;
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

export function checkIsIframeEmbed(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();

  if (
    lower.endsWith('.mp4') ||
    lower.endsWith('.m3u8') ||
    lower.endsWith('.webm') ||
    lower.endsWith('.ogg') ||
    lower.includes('.m3u8?') ||
    lower.includes('.mp4?')
  ) {
    return false;
  }

  return (
    lower.includes('player') ||
    lower.includes('embed') ||
    lower.includes('iframe') ||
    lower.includes('abyss') ||
    lower.includes('youtube.com') ||
    lower.includes('youtu.be') ||
    lower.includes('vidsrc') ||
    lower.includes('stackvid') ||
    lower.includes('streamtape') ||
    lower.includes('mixdrop') ||
    lower.includes('filemoon') ||
    lower.includes('doodstream') ||
    lower.includes('vidhide') ||
    lower.includes('streamwish') ||
    lower.includes('megacloud') ||
    lower.includes('vidstream') ||
    lower.includes('megaplay') ||
    lower.includes('zokoanime') ||
    lower.includes('megaplay.buzz') ||
    lower.includes('zokoanime.video') ||
    lower.includes('/stream/') ||
    lower.includes('/watch/') ||
    lower.includes('/v/') ||
    lower.includes('/e/') ||
    lower.includes('/player/')
  );
}

export function VideoPlayer({
  videoUrl,
  serverUrls,
  title,
  animeTitle,
  animeMalId,
  episodeNumber,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  posterUrl,
  thumbnailUrl,
  subtitleUrl,
  autoPlay = true,
  autoNext = true,
  autoSkip = false,
  lightsOff = false,
  activeServerIndex = 0,
  onServerIndexChange,
  onFullscreenChange,
}: VideoPlayerProps) {
  const { watchHistory, saveProgress } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const availableServers = React.useMemo(() => {
    const list: string[] = [];
    if (serverUrls && Array.isArray(serverUrls)) {
      serverUrls.forEach((s) => {
        if (s && typeof s === 'string' && s.trim() && !list.includes(s.trim())) {
          list.push(s.trim());
        }
      });
    }
    if (videoUrl && videoUrl.trim() && !list.includes(videoUrl.trim())) {
      list.unshift(videoUrl.trim());
    }
    return list;
  }, [videoUrl, serverUrls]);

  const [activeUrl, setActiveUrl] = useState(videoUrl || '');
  const [hasError, setHasError] = useState(false);
  const [useIframe, setUseIframe] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [resumePromptTime, setResumePromptTime] = useState<number | null>(null);
  const [skippedIntro, setSkippedIntro] = useState(false);
  const controlsTimeoutRef = useRef<any>(null);
  const lastSavedTimeRef = useRef<number>(-1);

  useEffect(() => {
    setHasError(false);
    setIframeLoading(true);
    const targetUrl = availableServers[activeServerIndex] || availableServers[0] || videoUrl;
    setActiveUrl(targetUrl);
    const isEmbed = checkIsIframeEmbed(targetUrl);
    setUseIframe(isEmbed);
    setSkippedIntro(false);

    if (videoRef.current && !isEmbed) {
      videoRef.current.load();
      if (autoPlay) {
        videoRef.current
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => {
            if (videoRef.current) {
              videoRef.current.muted = true;
              setIsMuted(true);
              videoRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
            }
          });
      }
    }
  }, [activeServerIndex, episodeNumber, availableServers, videoUrl, autoPlay]);

  useEffect(() => {
    const existing = watchHistory.find(
      (h) => h.anime_mal_id === animeMalId && h.episode_number === episodeNumber
    );
    if (existing && existing.progress_seconds > 10 && !existing.completed) {
      setResumePromptTime(existing.progress_seconds);
    } else {
      setResumePromptTime(null);
    }
  }, [animeMalId, episodeNumber, watchHistory]);

  useEffect(() => {
    if (autoSkip && !skippedIntro && currentTime >= 2 && currentTime < 85 && videoRef.current) {
      videoRef.current.currentTime = 85;
      setSkippedIntro(true);
    }
  }, [autoSkip, skippedIntro, currentTime]);

  const commitProgress = (currentSec: number, totalDur: number) => {
    if (totalDur <= 0) return;
    const flooredCur = Math.floor(currentSec);
    const flooredDur = Math.floor(totalDur);
    if (Math.abs(flooredCur - lastSavedTimeRef.current) < 3 && flooredCur < flooredDur) {
      return;
    }
    lastSavedTimeRef.current = flooredCur;
    saveProgress(animeMalId, episodeNumber, flooredCur, flooredDur);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (videoRef.current && !videoRef.current.paused && duration > 0) {
        commitProgress(videoRef.current.currentTime, duration);
      }
    }, 12000);
    return () => {
      clearInterval(interval);
      if (videoRef.current && duration > 0) {
        commitProgress(videoRef.current.currentTime, duration);
      }
    };
  }, [animeMalId, episodeNumber, duration, saveProgress]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current
          .play()
          .then(() => {
            setIsPlaying(true);
            setHasError(false);
          })
          .catch((err) => {
            if (err.name === 'NotAllowedError') {
              if (videoRef.current) {
                videoRef.current.muted = true;
                setIsMuted(true);
                videoRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
              }
            } else if (err.name !== 'AbortError') {
              setHasError(true);
            }
          });
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
        if (duration > 0) commitProgress(videoRef.current.currentTime, duration);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setHasError(false);
    }
  };

  const handleVideoEnded = () => {
    setIsPlaying(false);
    if (duration > 0) commitProgress(duration, duration);
    if (autoNext && hasNext) onNext();
  };

  const handleVideoError = () => {
    if (activeServerIndex === 0 && availableServers.length > 1) {
      onServerIndexChange?.(1);
    } else {
      setHasError(true);
    }
  };

  const skip = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = parseFloat(e.target.value);
    setCurrentTime(target);
    if (videoRef.current) videoRef.current.currentTime = target;
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const changeSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) videoRef.current.playbackRate = speed;
    setShowSettings(false);
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
        onFullscreenChange?.(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
        onFullscreenChange?.(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      const isFs = !!document.fullscreenElement;
      setIsFullscreen(isFs);
      onFullscreenChange?.(isFs);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, [onFullscreenChange]);

  const formatTime = (time: number) => {
    if (isNaN(time)) return '00:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleMouseMove = () => {
    setShowControls(true);
    clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !showSettings) setShowControls(false);
    }, 3000);
  };

  const isZoko = activeUrl.toLowerCase().includes('zokoanime.video');

  return (
    <div className="relative w-full">
      {lightsOff && (
        <div className="fixed inset-0 z-40 bg-black/85 transition-opacity duration-300 pointer-events-none" />
      )}

      <div
        id="anivault-video-container"
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => isPlaying && setShowControls(false)}
        className={`group relative aspect-video w-full overflow-hidden rounded-xl sm:rounded-2xl bg-black shadow-2xl border border-white/10 ${
          lightsOff ? 'z-50 ring-2 ring-purple-500/50 shadow-purple-950/50' : ''
        }`}
      >
        {!activeUrl ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#07070f] p-6 text-center z-30">
            <AlertTriangle className="h-12 w-12 text-amber-400 mb-3" />
            <h3 className="text-base font-bold text-white mb-1">No Streaming Server Available</h3>
            <p className="text-xs text-slate-400 max-w-md">No streaming server is available for this episode.</p>
          </div>
        ) : hasError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-6 text-center z-30">
            <AlertTriangle className="h-12 w-12 text-amber-500 mb-3" />
            <h3 className="text-base font-bold text-white mb-1">Video Stream Notice</h3>
            <p className="text-xs text-slate-400 max-w-md mb-4 leading-relaxed">
              Current server stream encountered an issue. Please switch to another server.
            </p>
            <button
              onClick={() => {
                setHasError(false);
                onServerIndexChange?.((activeServerIndex + 1) % availableServers.length);
              }}
              className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-purple-500 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Try Next Server</span>
            </button>
          </div>
        ) : useIframe ? (
          <div className="relative h-full w-full">
            {iframeLoading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/90">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
                <p className="mt-3 text-sm text-slate-300">Loading player...</p>
              </div>
            )}
            <iframe
              key={activeUrl}
              src={activeUrl}
              title={`${animeTitle} - Episode ${episodeNumber}`}
              className="h-full w-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              loading="eager"
              {...(!isZoko
                ? {
                    sandbox:
                      'allow-scripts allow-same-origin allow-presentation allow-forms allow-popups allow-popups-to-escape-sandbox',
                  }
                : {})}
              referrerPolicy="origin"
              onLoad={() => setIframeLoading(false)}
              onError={() => setIframeLoading(false)}
            />
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              src={activeUrl}
              poster={posterUrl || thumbnailUrl || undefined}
              onClick={togglePlay}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={handleVideoEnded}
              onError={handleVideoError}
              playsInline
              className="h-full w-full object-contain cursor-pointer"
            >
              {subtitleUrl && (
                <track kind="subtitles" src={subtitleUrl} srcLang="en" label="English" default />
              )}
            </video>

            {resumePromptTime !== null && (
              <div className="absolute bottom-20 left-1/2 z-40 -translate-x-1/2 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/80 px-4 py-2.5 shadow-xl backdrop-blur-md">
                <span className="text-xs text-white">Resume from {formatTime(resumePromptTime)}?</span>
                <button
                  onClick={() => {
                    if (videoRef.current) videoRef.current.currentTime = resumePromptTime;
                    setResumePromptTime(null);
                    togglePlay();
                  }}
                  className="rounded-lg bg-purple-600 px-3 py-1 text-xs font-bold text-white hover:bg-purple-500"
                >
                  Resume
                </button>
                <button
                  onClick={() => setResumePromptTime(null)}
                  className="rounded-lg bg-white/10 px-3 py-1 text-xs font-bold text-slate-300 hover:bg-white/20"
                >
                  Start Over
                </button>
              </div>
            )}

            <div
              className={`absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 pb-3 pt-12 transition-opacity ${
                showControls || !isPlaying ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <input
                type="range"
                min={0}
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
                className="mb-2 w-full accent-purple-500"
              />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button onClick={togglePlay} className="rounded-full p-1.5 text-white hover:bg-white/10">
                    {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                  </button>
                  <button onClick={() => skip(-10)} className="rounded-full p-1.5 text-white hover:bg-white/10">
                    <FastForward className="h-4 w-4 rotate-180" />
                  </button>
                  <button onClick={() => skip(10)} className="rounded-full p-1.5 text-white hover:bg-white/10">
                    <FastForward className="h-4 w-4" />
                  </button>
                  <button onClick={toggleMute} className="rounded-full p-1.5 text-white hover:bg-white/10">
                    {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-16 accent-purple-500"
                  />
                  <span className="text-[11px] font-medium text-slate-300">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="relative">
                    <button
                      onClick={() => setShowSettings(!showSettings)}
                      className="rounded-full p-1.5 text-white hover:bg-white/10"
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                    {showSettings && (
                      <div className="absolute bottom-10 right-0 z-50 min-w-[100px] rounded-xl border border-white/10 bg-[#0c0c14] p-2 shadow-xl">
                        {[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => (
                          <button
                            key={s}
                            onClick={() => changeSpeed(s)}
                            className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs ${
                              playbackSpeed === s ? 'bg-purple-600/30 text-purple-300' : 'text-slate-300 hover:bg-white/5'
                            }`}
                          >
                            <span>{s}x</span>
                            {playbackSpeed === s && <Check className="h-3 w-3" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={toggleFullscreen} className="rounded-full p-1.5 text-white hover:bg-white/10">
                    {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
